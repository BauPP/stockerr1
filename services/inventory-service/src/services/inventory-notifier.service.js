class InventoryNotifier {
  constructor({ ms06MovementWebhookUrl, ms09MovementWebhookUrl, fetchImpl = fetch } = {}) {
    this.ms06MovementWebhookUrl = ms06MovementWebhookUrl;
    this.ms09MovementWebhookUrl = ms09MovementWebhookUrl;
    this.fetchImpl = fetchImpl;
  }

  async post(url, payload) {
    if (!url) {
      return;
    }

    await this.fetchImpl(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
  }

  async notifyMovementRegistered(movement) {
    const event = {
      event: 'inventory.movement.created',
      data: movement,
    };

    await Promise.allSettled([
      this.post(this.ms06MovementWebhookUrl, event),
      this.post(this.ms09MovementWebhookUrl, event),
    ]);
  }
}

module.exports = { InventoryNotifier };
