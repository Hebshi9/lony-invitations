// Queue Manager - Smart message distribution across multiple accounts
import { createClient } from '@supabase/supabase-js';
import whatsappService from './baileys-service.js';

const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.VITE_SUPABASE_ANON_KEY
);

class QueueManager {
    constructor() {
        this.isRunning = false;
        this.isPaused = false;


        // 🛡️ Anti-Ban Configuration
        this.config = {
            mode: 'balanced', // 'safe', 'balanced', or 'aggressive'
        };

        // Define settings for each mode
        this.modes = {
            safe: {
                delays: {
                    betweenMessages: { min: 20000, max: 40000 },
                    betweenBatches: { min: 20 * 60 * 1000, max: 30 * 60 * 1000 },
                    randomBreaks: { probability: 0.20, min: 5 * 60 * 1000, max: 10 * 60 * 1000 }
                },
                limits: {
                    messagesPerBatch: 10,
                    messagesPerHour: 20,
                    messagesPerDay: 150,
                    maxBurstSize: 5,
                    cooldownAfterBurst: 15 * 60 * 1000
                }
            },
            balanced: { // Default - Good for ~300-400/day
                delays: {
                    betweenMessages: { min: 10000, max: 25000 },
                    betweenBatches: { min: 10 * 60 * 1000, max: 20 * 60 * 1000 },
                    randomBreaks: { probability: 0.15, min: 3 * 60 * 1000, max: 8 * 60 * 1000 }
                },
                limits: {
                    messagesPerBatch: 20,
                    messagesPerHour: 40,
                    messagesPerDay: 400,
                    maxBurstSize: 10,
                    cooldownAfterBurst: 10 * 60 * 1000
                }
            },
            aggressive: { // WARNING: High Risk - ~800+/day
                delays: {
                    betweenMessages: { min: 5000, max: 15000 },
                    betweenBatches: { min: 5 * 60 * 1000, max: 10 * 60 * 1000 },
                    randomBreaks: { probability: 0.10, min: 2 * 60 * 1000, max: 5 * 60 * 1000 }
                },
                limits: {
                    messagesPerBatch: 40,
                    messagesPerHour: 80,
                    messagesPerDay: 1000,
                    maxBurstSize: 20,
                    cooldownAfterBurst: 5 * 60 * 1000
                }
            }
        };

        this.humanBehavior = {
            avoidHours: [0, 1, 2, 3, 4, 5],
            preferredHours: [9, 10, 11, 14, 15, 16, 19, 20, 21],
            slowHours: [12, 13, 22, 23]
        };

        // Initialize with default mode
        this.applyMode('balanced');

        // Rate limiting state
        this.rateLimiter = {
            hourlyCount: 0,
            burstCount: 0,
            lastResetHour: new Date().getHours(),
            consecutiveFailures: 0
        };
    }

    applyMode(mode) {
        if (this.modes[mode]) {
            this.config = {
                mode,
                delays: this.modes[mode].delays,
                limits: this.modes[mode].limits,
                humanBehavior: this.humanBehavior
            };
            console.log(`🛡️ Switched Anti-Ban Mode to: ${mode.toUpperCase()}`);
        }
    }

    log(message) {
        console.log(message);
        this.lastLog = message;
    }

    /**
     * Start sending messages for an event
     */
    async startSending(eventId) {
        if (this.isRunning) {
            throw new Error('Queue is already running');
        }

        this.isRunning = true;
        this.isPaused = false;
        this.currentEventId = eventId;

        this.log(`Starting queue for event ${eventId}`);
        // Do not await processQueue, let it run in background
        this.processQueue().catch(err => {
            console.error('Queue processing ended with error:', err);
            this.stop();
        });
    }

    /**
     * Process the message queue
     */
    async processQueue() {
        this.log('🚀 Queue processing started loop...');
        console.log(`📍 Current Event ID: ${this.currentEventId}`);

        while (this.isRunning && !this.isPaused) {
            try {
                // Reset daily counts if needed
                await this.resetDailyCounts();

                // Get available accounts
                const availableAccounts = await this.getAvailableAccounts();
                this.log(`📊 Found ${availableAccounts.length} available accounts`);

                if (availableAccounts.length === 0) {
                    this.log('⚠️ No available accounts. Pausing queue.');
                    this.pause();
                    break;
                }

                // Get pending messages
                const pendingMessages = await this.getPendingMessages();
                this.log(`📩 Found ${pendingMessages.length} pending messages`);

                if (pendingMessages.length === 0) {
                    this.log('✅ No more pending messages. Queue complete.');
                    this.stop();
                    break;
                }

                // Distribute messages across available accounts
                this.log(`📤 Distributing ${pendingMessages.length} messages...`);
                await this.distributeMessages(pendingMessages, availableAccounts);

                // Wait before next batch
                if (this.isRunning && !this.isPaused) {
                    const batchDelay = this.getSmartDelay('batch');
                    this.log(`⏳ Waiting ${(batchDelay / 1000 / 60).toFixed(1)} min for next batch...`);
                    await this.sleep(batchDelay);
                }
            } catch (error) {
                console.error('🔥 CRITICAL ERROR in Queue Loop:', error);
                this.stop();
                break;
            }
        }
        this.log('🛑 Queue processing loop ended.');
    }

    /**
     * Distribute messages across multiple accounts
     */
    async distributeMessages(messages, accounts) {
        const messagesPerAccount = Math.ceil(messages.length / accounts.length);

        for (let i = 0; i < accounts.length; i++) {
            const account = accounts[i];
            const accountMessages = messages.slice(
                i * messagesPerAccount,
                (i + 1) * messagesPerAccount
            );

            // Send messages for this account
            for (const message of accountMessages) {
                if (!this.isRunning || this.isPaused) break;

                // Check if we can send now (rate limiting)
                const canSend = await this.canSendNow();
                if (!canSend) {
                    this.log('⏸️ Rate limit reached, pausing queue...');
                    this.pause();
                    break;
                }

                await this.sendMessage(account, message);

                // Smart delay between messages
                const delay = this.getSmartDelay('message');
                this.log(`⏱️ Waiting ${(delay / 1000).toFixed(1)}s (Safe Mode)...`);
                await this.sleep(delay);
            }
        }
    }

    /**
     * Send a single message
     */
    async sendMessage(account, message) {
        console.log(`[QueueManager] 📤 Attempting to send to ${message.phone} via account ${account.phone || account.id}`);
        console.log(`[QueueManager] Message ID: ${message.id}, Phase: ${message.message_phase}`);

        try {
            // Update status to 'queued'
            await supabase
                .from('whatsapp_messages')
                .update({ status: 'queued' })
                .eq('id', message.id);
            console.log(`[QueueManager] ✓ Status updated to 'queued'`);

            // Add slight variation to message (anti-detection)
            const variedMessage = this.addMessageVariation(message.message_text);

            // Send via WhatsApp
            console.log(`[QueueManager] 📤 Calling whatsappService.sendMessage...`);
            const result = await whatsappService.sendMessage(
                account.id,
                message.phone,
                variedMessage,
                message.image_url
            );
            console.log(`[QueueManager] 🎉 WhatsApp send successful:`, result);

            // Update status to 'sent'
            await supabase
                .from('whatsapp_messages')
                .update({
                    status: 'sent',
                    sent_at: new Date().toISOString(),
                    sender_account: account.phone
                })
                .eq('id', message.id);
            console.log(`[QueueManager] ✓ Database updated: status='sent'`);

            // Increment account message count
            await supabase
                .from('whatsapp_accounts')
                .update({
                    messages_sent_today: account.messages_sent_today + 1
                })
                .eq('id', account.id);

            // Record successful send
            this.recordMessageSent();

            this.log(`✅ Sent message to ${message.phone} via ${account.phone}`);
            console.log(`[QueueManager] =========================================\n`);

        } catch (error) {
            console.error(`[QueueManager] ❌ SEND FAILED for ${message.phone}:`);
            console.error(`[QueueManager] Error details:`, error.message);
            console.error(`[QueueManager] Full error:`, error);

            // Check for ban warning signs
            const warningStatus = this.checkWarningSign(error);
            if (warningStatus === 'STOP') {
                console.error(`[QueueManager] 🚨 Critical warning - stopping queue`);
                return;
            } else if (warningStatus === 'PAUSE') {
                console.log('[QueueManager] ⚠️ Warning sign detected - pausing queue');
                this.pause();
            }

            // Update status to 'failed'
            await supabase
                .from('whatsapp_messages')
                .update({
                    status: 'failed',
                    error_message: error.message,
                    retry_count: (message.retry_count || 0) + 1
                })
                .eq('id', message.id);

            this.log(`❌ Failed to send to ${message.phone}: ${error.message}`);
            console.log(`[QueueManager] =========================================\n`);
        }
    }

    /**
     * Get available accounts (connected and under daily limit)
     */
    async getAvailableAccounts() {
        const { data, error } = await supabase
            .from('whatsapp_accounts')
            .select('*')
            .eq('status', 'connected');

        if (error) {
            console.error('Error fetching accounts:', error);
            return [];
        }

        // Filter in JS to avoid Supabase column comparison issues
        return (data || []).filter(account => {
            const limit = account.daily_limit || 170;
            const sent = account.messages_sent_today || 0;
            return sent < limit;
        });
    }

    /**
     * Get pending messages for the current event
     */
    async getPendingMessages(limit = null) {
        const batchSize = limit || this.config.limits.messagesPerBatch;

        const { data, error } = await supabase
            .from('whatsapp_messages')
            .select('*')
            .eq('event_id', this.currentEventId)
            .eq('status', 'pending')
            .limit(batchSize);

        if (error) {
            console.error('Error fetching messages:', error);
            return [];
        }

        return data || [];
    }

    /**
     * Reset daily counts for accounts
     */
    async resetDailyCounts() {
        const { error } = await supabase.rpc('reset_daily_whatsapp_counts');

        if (error) {
            console.error('Error resetting daily counts:', error);
        }
    }

    /**
     * Pause the queue
     */
    pause() {
        console.log('Queue paused');
        this.isPaused = true;
    }

    /**
     * Resume the queue
     */
    async resume() {
        if (!this.isRunning) {
            throw new Error('Queue is not running');
        }

        console.log('Queue resumed');
        this.isPaused = false;
        // Do not await processQueue
        this.processQueue().catch(err => {
            console.error('Queue processing (resume) ended with error:', err);
            this.stop();
        });
    }

    /**
     * Stop the queue
     */
    stop() {
        console.log('Queue stopped');
        this.isRunning = false;
        this.isPaused = false;
        this.currentEventId = null;
    }

    /**
     * Get queue status
     */
    async getStatus() {
        if (!this.currentEventId) {
            return {
                isRunning: false,
                isPaused: false,
                eventId: null,
                stats: null,
                lastLog: this.lastLog || 'No activity'
            };
        }

        // Get message statistics
        const { data: stats } = await supabase
            .from('whatsapp_messages')
            .select('status')
            .eq('event_id', this.currentEventId);

        const statusCounts = {
            pending: 0,
            queued: 0,
            sent: 0,
            failed: 0
        };

        stats?.forEach(msg => {
            statusCounts[msg.status] = (statusCounts[msg.status] || 0) + 1;
        });

        return {
            isRunning: this.isRunning,
            isPaused: this.isPaused,
            eventId: this.currentEventId,
            stats: statusCounts,
            lastLog: this.lastLog || 'Processing...'
        };
    }

    /**
     * Sleep utility
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // ============================================
    // 🛡️ ANTI-BAN HELPER METHODS
    // ============================================

    /**
     * Get smart delay with randomization and human-like breaks
     */
    getSmartDelay(type = 'message') {
        const delayConfig = type === 'batch'
            ? this.config.delays.betweenBatches
            : this.config.delays.betweenMessages;

        // Random delay within range
        const baseDelay = Math.random() * (delayConfig.max - delayConfig.min) + delayConfig.min;

        // Random break (simulates human behavior)
        if (Math.random() < this.config.delays.randomBreaks.probability) {
            const breakDuration = Math.random() *
                (this.config.delays.randomBreaks.max - this.config.delays.randomBreaks.min) +
                this.config.delays.randomBreaks.min;

            console.log(`🧘 Taking a random break: ${(breakDuration / 1000 / 60).toFixed(1)} minutes`);
            return baseDelay + breakDuration;
        }

        // Apply hour multiplier
        const hourMultiplier = this.getHourMultiplier();
        return baseDelay * hourMultiplier;
    }

    /**
     * Check if we can send now (rate limiting)
     */
    async canSendNow() {
        // Check time of day
        if (!this.shouldSendAtThisHour()) {
            console.log('😴 Avoiding sending at this hour');
            return false;
        }

        // Reset hourly count if needed
        const currentHour = new Date().getHours();
        if (currentHour !== this.rateLimiter.lastResetHour) {
            this.rateLimiter.hourlyCount = 0;
            this.rateLimiter.lastResetHour = currentHour;
        }

        // Check hourly limit
        if (this.rateLimiter.hourlyCount >= this.config.limits.messagesPerHour) {
            console.log('⏸️ Hourly limit reached, waiting...');
            return false;
        }

        // Check burst limit
        if (this.rateLimiter.burstCount >= this.config.limits.maxBurstSize) {
            console.log('🛑 Burst limit reached, cooling down...');
            await this.sleep(this.config.limits.cooldownAfterBurst);
            this.rateLimiter.burstCount = 0;
        }

        return true;
    }

    /**
     * Record that a message was sent
     */
    recordMessageSent() {
        this.rateLimiter.hourlyCount++;
        this.rateLimiter.burstCount++;
        this.rateLimiter.consecutiveFailures = 0; // Reset on success
    }

    /**
     * Check if we should send at this hour
     */
    shouldSendAtThisHour() {
        const hour = new Date().getHours();

        // Avoid late night/early morning
        if (this.config.humanBehavior.avoidHours.includes(hour)) {
            return false;
        }

        return true;
    }

    /**
     * Get delay multiplier based on hour
     */
    getHourMultiplier() {
        const hour = new Date().getHours();

        if (this.config.humanBehavior.preferredHours.includes(hour)) {
            return 1.0; // Normal speed
        } else if (this.config.humanBehavior.slowHours.includes(hour)) {
            return 1.5; // 50% slower
        }

        return 1.2; // Slightly slower
    }

    /**
     * Check for warning signs of potential ban
     */
    checkWarningSign(error) {
        const warningPatterns = [
            'rate limit',
            'too many requests',
            'spam',
            'blocked',
            '429',
            'flood'
        ];

        const errorMsg = error.message.toLowerCase();
        const isWarning = warningPatterns.some(pattern =>
            errorMsg.includes(pattern)
        );

        if (isWarning) {
            this.rateLimiter.consecutiveFailures++;

            console.warn(`⚠️ WARNING SIGN DETECTED: ${error.message}`);
            console.warn(`Consecutive failures: ${this.rateLimiter.consecutiveFailures}`);

            // Critical: Stop immediately if multiple failures
            if (this.rateLimiter.consecutiveFailures >= 3) {
                console.error('🚨 CRITICAL: Multiple failures detected! Stopping immediately.');
                this.stop();
                return 'STOP';
            }

            // Pause for extended period
            return 'PAUSE';
        }

        return 'OK';
    }

    /**
     * Add slight variation to message (anti-detection)
     */
    addMessageVariation(message) {
        const variations = ['', ' ', '\n'];
        const variation = variations[Math.floor(Math.random() * variations.length)];
        return message + variation;
    }
}

// Singleton instance
const queueManager = new QueueManager();

export default queueManager;
