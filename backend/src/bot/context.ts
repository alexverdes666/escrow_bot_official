import { Context, Scenes } from 'telegraf';
import { IUser } from '../models';

export interface DealCreationState {
  role?: 'buyer' | 'seller';
  counterpartyUsername?: string;
  counterpartyTelegramId?: number;
  counterpartyDbId?: string;
  templateSlug?: string;
  templateName?: string;
  terms: {
    description?: string;
    paymentType?: string;
    totalAmount?: number;
    currency?: string;
    depositPercent?: number;
    milestones?: Array<{ title: string; amount: number; dueDate?: string }>;
    deliveryDeadlineDays?: number;
    autoReleaseDays?: number;
    disputeWindowDays?: number;
    buyerObligations?: string;
    sellerObligations?: string;
    customConditions?: string[];
  };
  // Crypto payment fields
  cryptoChain?: 'ETH' | 'BTC' | 'TRON';
  cryptoToken?: 'TRX' | 'USDT';
  buyerWalletAddress?: string;
  originType: 'private' | 'group' | 'supergroup';
  originChatId?: number;
  originChatTitle?: string;
  currentStep: number;
  awaitingInput?: string;
  milestoneIndex?: number;
}

export interface DisputeState {
  dealId?: string;
  reason?: string;
}

export interface BotSessionData extends Scenes.WizardSessionData {
  dealCreation?: DealCreationState;
  dispute?: DisputeState;
  pendingSellerWallet?: string; // dealId awaiting seller wallet address for crypto
}

export type BotContext = Context & Scenes.WizardContext<BotSessionData> & {
  dbUser?: IUser;
};

// Helper to access custom session data (Telegraf wraps session in WizardSession)
export function getSession(ctx: BotContext): BotSessionData {
  return ctx.session as unknown as BotSessionData;
}
