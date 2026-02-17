import {
  send24hReminderAutomation,
  sendBirthdayAutomation,
  sendOverdue30DaysAutomation,
} from "@/services/automationService";

export async function runDailyAutomations() {
  await Promise.all([
    send24hReminderAutomation(),
    sendBirthdayAutomation(),
    sendOverdue30DaysAutomation(),
  ]);
}
