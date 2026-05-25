/**
 * GameState
 * Manages all game tracking: wagon health, bales, game status, etc.
 */
export class GameState {
  constructor() {
    // ═══════════════════ Wagon Health ═══════════════════
    this.wagonMaxHealth = 100;
    this.wagonHealth = this.wagonMaxHealth;
    this.wagonCollisionCooldown = 0;
    this.wagonCollisionCooldownDuration = 0.5; // seconds

    // ═══════════════════ Bales / Items ═══════════════════
    this.balesOnBoard = 0;
    this.totalBalesDelivered = 0;

    // ═══════════════════ Game State ═══════════════════
    this.gameState = 'PLAYING'; // 'PLAYING' | 'GAME_OVER'
  }

  /**
   * Apply damage to the wagon.
   * Returns true if damage was applied (not on cooldown), false otherwise.
   */
  damageWagon(amount = 10) {
    if (this.wagonCollisionCooldown > 0) {
      return false; // Still in cooldown
    }

    this.wagonHealth = Math.max(0, this.wagonHealth - amount);
    this.wagonCollisionCooldown = this.wagonCollisionCooldownDuration;

    // Check if wagon is destroyed
    if (this.wagonHealth <= 0) {
      this.gameState = 'GAME_OVER';
    }

    return true;
  }

  /**
   * Update collision cooldown timer.
   */
  update(deltaTime) {
    if (this.wagonCollisionCooldown > 0) {
      this.wagonCollisionCooldown -= deltaTime;
    }
  }

  /**
   * Add bales to the wagon.
   */
  addBales(count = 1) {
    this.balesOnBoard += count;
  }

  /**
   * Remove bales (when delivering).
   */
  removeBales(count = 1) {
    const removed = Math.min(count, this.balesOnBoard);
    this.balesOnBoard -= removed;
    return removed;
  }

  /**
   * Deliver bales to the barn.
   */
  deliverBales(count = null) {
    if (count === null) {
      count = this.balesOnBoard;
    }
    const delivered = this.removeBales(count);
    this.totalBalesDelivered += delivered;
    return delivered;
  }

  /**
   * Get health as a percentage (0-100).
   */
  getHealthPercent() {
    return (this.wagonHealth / this.wagonMaxHealth) * 100;
  }

  /**
   * Check if game is over.
   */
  isGameOver() {
    return this.gameState === 'GAME_OVER';
  }

  /**
   * Check if game is playing.
   */
  isPlaying() {
    return this.gameState === 'PLAYING';
  }

  /**
   * Reset the game state.
   */
  reset() {
    this.wagonHealth = this.wagonMaxHealth;
    this.wagonCollisionCooldown = 0;
    this.balesOnBoard = 0;
    this.totalBalesDelivered = 0;
    this.gameState = 'PLAYING';
  }
}
