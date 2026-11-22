const timers = new Map();

export function scheduleFollowUp(accountId, conversationId, config, adapter) {
  const followUpMsg = config?.inbox?.FOLLOW_UP_MESSAGE;
  const delaySec = Number(config?.inbox?.FOLLOW_UP_DELAY_SECONDS) || 0;
  const maxReminders = Number(config?.inbox?.FOLLOW_UP_MAX_REMINDERS) || 1;

  if (!followUpMsg || !delaySec || delaySec < 1) return;

  cancelFollowUp(conversationId);

  const state = { reminders: 0, maxReminders, timer: null };

  const fire = async () => {
    try {
      const { sendMessage } = adapter;
      await sendMessage(accountId, conversationId, followUpMsg);
      console.log(`(FollowUp) Sent reminder ${state.reminders + 1}/${state.maxReminders} to conversation ${conversationId}`);
    } catch (e) {
      console.error(`(FollowUp) Failed to send reminder:`, e?.message);
    }
    state.reminders++;
    if (state.reminders < state.maxReminders) {
      state.timer = setTimeout(fire, delaySec * 1000);
    } else {
      timers.delete(conversationId);
    }
  };

  state.timer = setTimeout(fire, delaySec * 1000);
  timers.set(conversationId, state);
  console.log(`(FollowUp) Scheduled follow-up in ${delaySec}s for conversation ${conversationId}`);
}

export function cancelFollowUp(conversationId) {
  const state = timers.get(conversationId);
  if (state?.timer) {
    clearTimeout(state.timer);
    timers.delete(conversationId);
  }
}

export function getActiveFollowUps() {
  return Array.from(timers.keys());
}
