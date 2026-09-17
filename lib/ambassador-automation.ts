import { prisma } from "@/lib/db";
import { addDays, ambassadorConfig } from "@/lib/ambassador-config";
import { sendAmbassadorOperationalEmail } from "@/lib/email";
import { deleteAmbassadorDocument } from "@/lib/ambassador-storage";

type Recipient = {
  id: string;
  email: string;
  firstName: string;
};

async function notifyOnce(
  recipient: Recipient,
  type: string,
  referenceId: string,
  message: Omit<
    Parameters<typeof sendAmbassadorOperationalEmail>[0],
    "to" | "firstName"
  >
) {
  const key = {
    ambassadorId_type_referenceId: {
      ambassadorId: recipient.id,
      type,
      referenceId
    }
  };
  const existing = await prisma.ambassadorNotification.findUnique({
    where: key
  });
  if (existing?.status === "sent") return false;
  if (!existing) {
    try {
      await prisma.ambassadorNotification.create({
        data: {
          ambassadorId: recipient.id,
          type,
          referenceId,
          status: "sending"
        }
      });
    } catch {
      return false;
    }
  } else {
    await prisma.ambassadorNotification.update({
      where: { id: existing.id },
      data: { status: "sending", error: null }
    });
  }
  const result = await sendAmbassadorOperationalEmail({
    to: recipient.email,
    firstName: recipient.firstName,
    ...message
  });
  await prisma.ambassadorNotification.update({
    where: key,
    data: {
      status: result.ok ? "sent" : "failed",
      error: result.error || null,
      sentAt: new Date()
    }
  });
  return result.ok;
}

async function pauseAmbassadors(ids: string[], now: Date) {
  if (!ids.length) return;
  await prisma.$transaction([
    prisma.ambassador.updateMany({
      where: { id: { in: ids } },
      data: { status: "PAUSED", pausedAt: now, referralActive: false }
    }),
    prisma.ambassadorCoupon.updateMany({
      where: { ambassadorId: { in: ids }, active: true },
      data: { active: false, disabledAt: now }
    })
  ]);
}

export async function processAmbassadorDeadlines(now = new Date()) {
  const config = ambassadorConfig();
  const reminderLimit = addDays(now, 3);
  const reminders = await prisma.ambassador.findMany({
    where: {
      status: "ACTIVE_PENDING_FIRST_CONTENT",
      firstContentDueAt: { gt: now, lte: reminderLimit },
      contents: { none: { status: { in: ["APPROVED", "PUBLISHED"] } } }
    },
    select: { id: true, email: true, firstName: true, firstContentDueAt: true }
  });
  for (const recipient of reminders) {
    await notifyOnce(
      recipient,
      "FIRST_CONTENT_REMINDER",
      recipient.firstContentDueAt?.toISOString() || "",
      {
        kind: "content_reminder",
        dueAt: recipient.firstContentDueAt,
        detail:
          "İlk kalıcı içeriğini son tarihten önce panelden incelemeye göndermeyi unutma."
      }
    );
  }

  const finalWarnings = await prisma.ambassador.findMany({
    where: {
      status: "ACTIVE_PENDING_FIRST_CONTENT",
      firstContentDueAt: { lte: now },
      contents: { none: { status: { in: ["APPROVED", "PUBLISHED"] } } }
    },
    select: {
      id: true,
      email: true,
      firstName: true,
      firstContentFinalDueAt: true
    }
  });
  if (finalWarnings.length) {
    await prisma.ambassador.updateMany({
      where: { id: { in: finalWarnings.map((row) => row.id) } },
      data: { status: "FINAL_CONTENT_WARNING" }
    });
    for (const recipient of finalWarnings) {
      await notifyOnce(
        recipient,
        "FIRST_CONTENT_FINAL_WARNING",
        recipient.firstContentFinalDueAt?.toISOString() || "",
        {
          kind: "content_final_warning",
          dueAt: recipient.firstContentFinalDueAt,
          detail:
            "İçerik gönderilmezse kupon ve referral geçici olarak duraklatılacak."
        }
      );
    }
  }

  const overdue = await prisma.ambassador.findMany({
    where: {
      status: "FINAL_CONTENT_WARNING",
      firstContentFinalDueAt: { lte: now },
      contents: { none: { status: { in: ["APPROVED", "PUBLISHED"] } } }
    },
    select: { id: true, email: true, firstName: true }
  });
  await pauseAmbassadors(
    overdue.map((row) => row.id),
    now
  );
  for (const recipient of overdue) {
    await notifyOnce(recipient, "FIRST_CONTENT_PAUSED", "initial", {
      kind: "content_paused",
      detail:
        "İlk içerik süresi tamamlandığı için kupon ve referral geçici olarak kapatıldı."
    });
  }

  const inactiveBefore = addDays(now, -config.inactivityDays);
  const inactivityWarningStart = addDays(
    now,
    -(config.inactivityDays - config.inactivityWarningDays)
  );
  const inactivityWarnings = await prisma.ambassador.findMany({
    where: {
      status: "ACTIVE",
      lastActivityAt: { lte: inactivityWarningStart, gt: inactiveBefore }
    },
    select: { id: true, email: true, firstName: true, lastActivityAt: true }
  });
  for (const recipient of inactivityWarnings) {
    await notifyOnce(
      recipient,
      "INACTIVITY_WARNING",
      recipient.lastActivityAt?.toISOString() || "",
      {
        kind: "inactivity_warning",
        dueAt: addDays(
          recipient.lastActivityAt || now,
          config.inactivityDays
        ),
        detail:
          "Panel aktivitesi olmazsa Elçi hesabın güvenlik amacıyla geçici olarak duraklatılacak."
      }
    );
  }
  const inactive = await prisma.ambassador.findMany({
    where: { status: "ACTIVE", lastActivityAt: { lte: inactiveBefore } },
    select: { id: true }
  });
  await pauseAmbassadors(
    inactive.map((row) => row.id),
    now
  );

  const urgentViolations = await prisma.ambassadorContent.findMany({
    where: {
      status: "REMOVAL_REQUESTED",
      urgentRemovalDueAt: { lte: now },
      ambassador: { status: { notIn: ["PAUSED", "TERMINATED"] } }
    },
    select: { ambassadorId: true }
  });
  await pauseAmbassadors(
    [...new Set(urgentViolations.map((row) => row.ambassadorId))],
    now
  );

  const terminating = await prisma.ambassador.findMany({
    where: {
      terminationEffectiveAt: { lte: now },
      status: { not: "TERMINATED" }
    },
    select: { id: true }
  });
  if (terminating.length) {
    const ids = terminating.map((row) => row.id);
    await prisma.$transaction([
      prisma.ambassador.updateMany({
        where: { id: { in: ids } },
        data: {
          status: "TERMINATED",
          terminatedAt: now,
          retentionDeleteAfter: addDays(now, config.retentionDays),
          referralActive: false
        }
      }),
      prisma.ambassadorCoupon.updateMany({
        where: { ambassadorId: { in: ids }, active: true },
        data: { active: false, disabledAt: now }
      })
    ]);
  }

  return {
    reminders: reminders.length,
    finalWarnings: finalWarnings.length,
    pausedOverdue: overdue.length,
    pausedInactive: inactive.length,
    pausedUrgentViolation: urgentViolations.length,
    terminated: terminating.length
  };
}

export async function purgeExpiredAmbassadorData(now = new Date()) {
  const config = ambassadorConfig();
  if (!config.retentionJobEnabled) return { enabled: false, purged: 0 };
  const rows = await prisma.ambassador.findMany({
    where: {
      status: "TERMINATED",
      retentionDeleteAfter: { lte: now },
      taxIdEncrypted: { not: null }
    },
    include: { documents: true }
  });
  let purged = 0;
  for (const ambassador of rows) {
    let storageOk = true;
    for (const document of ambassador.documents) {
      try {
        await deleteAmbassadorDocument(document.storageKey);
      } catch {
        storageOk = false;
        break;
      }
    }
    if (!storageOk) continue;
    await prisma.$transaction([
      prisma.ambassadorDocument.deleteMany({
        where: { ambassadorId: ambassador.id }
      }),
      prisma.ambassadorConsent.deleteMany({
        where: { ambassadorId: ambassador.id }
      }),
      prisma.ambassadorContent.deleteMany({
        where: { ambassadorId: ambassador.id }
      }),
      prisma.ambassadorReferral.deleteMany({
        where: { ambassadorId: ambassador.id }
      }),
      prisma.ambassadorAdminNote.deleteMany({
        where: { ambassadorId: ambassador.id }
      }),
      prisma.ambassador.update({
        where: { id: ambassador.id },
        data: {
          userId: null,
          inviteId: null,
          firstName: "Silindi",
          lastName: "",
          email: `deleted+${ambassador.id}@invalid.local`,
          phone: "",
          birthDate: new Date("1970-01-01T00:00:00.000Z"),
          shippingAddress: "",
          city: "",
          district: "",
          postalCode: "",
          instagramUsername: "",
          tiktokUsername: "",
          youtubeUsername: "",
          otherSocialUrl: "",
          taxIdEncrypted: null,
          taxIdLast4: null,
          taxOffice: null,
          businessName: null,
          invoiceAddress: null,
          ibanEncrypted: null,
          ibanLast4: null,
          ibanHolderName: null,
          referralToken: null,
          retentionDeleteAfter: null
        }
      })
    ]);
    purged += 1;
  }
  return { enabled: true, purged };
}
