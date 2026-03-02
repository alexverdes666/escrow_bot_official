import { Schema, model, Document, Types } from 'mongoose';

// Sub-schemas
const milestoneSchema = new Schema({
  title: { type: String, required: true },
  description: { type: String },
  amount: { type: Number, required: true },
  dueDate: { type: Date },
  status: {
    type: String,
    enum: ['pending', 'in_progress', 'delivered', 'confirmed', 'disputed'],
    default: 'pending',
  },
  deliveredAt: { type: Date },
  confirmedAt: { type: Date },
}, { _id: true });

const dealTermsSchema = new Schema({
  paymentType: {
    type: String,
    enum: ['full_prepay', 'partial_prepay', 'milestone', 'no_prepay', 'custom'],
    required: true,
  },
  totalAmount: { type: Number, required: true },
  currency: { type: String, required: true, default: 'USD' },
  depositPercent: { type: Number, min: 0, max: 100 },
  depositAmount: { type: Number },
  milestones: [milestoneSchema],
  deliveryDeadlineDays: { type: Number },
  deliveryDeadlineDate: { type: Date },
  autoReleaseDays: { type: Number, default: 3 },
  autoReleaseDate: { type: Date },
  disputeWindowDays: { type: Number, default: 3 },
  buyerObligations: { type: String },
  sellerObligations: { type: String },
  customConditions: [{ type: String }],
  description: { type: String, required: true },
}, { _id: false });

const statusHistorySchema = new Schema({
  status: { type: String, required: true },
  changedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  changedAt: { type: Date, default: Date.now },
  note: { type: String },
}, { _id: false });

const originSchema = new Schema({
  type: { type: String, enum: ['private', 'group', 'supergroup'], required: true },
  chatId: { type: Number },
  chatTitle: { type: String },
}, { _id: false });

// Deal statuses
export const DEAL_STATUSES = [
  'draft',
  'pending_agreement',
  'active',
  'payment_confirmed',
  'in_progress',
  'delivered',
  'completed',
  'disputed',
  'cancelled',
  'resolved',
] as const;

export type DealStatus = typeof DEAL_STATUSES[number];

export interface IMilestone {
  title: string;
  description?: string;
  amount: number;
  dueDate?: Date;
  status: 'pending' | 'in_progress' | 'delivered' | 'confirmed' | 'disputed';
  deliveredAt?: Date;
  confirmedAt?: Date;
}

export interface IDealTerms {
  paymentType: 'full_prepay' | 'partial_prepay' | 'milestone' | 'no_prepay' | 'custom';
  totalAmount: number;
  currency: string;
  depositPercent?: number;
  depositAmount?: number;
  milestones?: IMilestone[];
  deliveryDeadlineDays?: number;
  deliveryDeadlineDate?: Date;
  autoReleaseDays: number;
  autoReleaseDate?: Date;
  disputeWindowDays: number;
  buyerObligations?: string;
  sellerObligations?: string;
  customConditions?: string[];
  description: string;
}

export interface IDeal extends Document {
  dealId: string;
  buyer: Types.ObjectId;
  seller: Types.ObjectId;
  createdBy: Types.ObjectId;
  status: DealStatus;
  template: Types.ObjectId | null;
  templateName: string | null;
  terms: IDealTerms;
  origin: {
    type: 'private' | 'group' | 'supergroup';
    chatId?: number;
    chatTitle?: string;
  };
  buyerAgreed: boolean;
  sellerAgreed: boolean;
  buyerAgreedAt: Date | null;
  sellerAgreedAt: Date | null;
  paymentConfirmed: boolean;
  paymentConfirmedAt: Date | null;
  paymentConfirmedBy: Types.ObjectId | null;
  deliveredAt: Date | null;
  completedAt: Date | null;
  cancelledAt: Date | null;
  cancelledBy: Types.ObjectId | null;
  cancelReason: string | null;
  statusHistory: Array<{
    status: string;
    changedBy?: Types.ObjectId;
    changedAt: Date;
    note?: string;
  }>;
  botMessageIds: {
    buyer: number[];
    seller: number[];
  };
  createdAt: Date;
  updatedAt: Date;
}

const dealSchema = new Schema<IDeal>(
  {
    dealId: { type: String, required: true, unique: true, index: true },
    buyer: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    seller: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    status: {
      type: String,
      enum: DEAL_STATUSES,
      default: 'draft',
      index: true,
    },
    template: { type: Schema.Types.ObjectId, ref: 'DealTemplate', default: null },
    templateName: { type: String, default: null },
    terms: { type: dealTermsSchema, required: true },
    origin: { type: originSchema, required: true },
    buyerAgreed: { type: Boolean, default: false },
    sellerAgreed: { type: Boolean, default: false },
    buyerAgreedAt: { type: Date, default: null },
    sellerAgreedAt: { type: Date, default: null },
    paymentConfirmed: { type: Boolean, default: false },
    paymentConfirmedAt: { type: Date, default: null },
    paymentConfirmedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    deliveredAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
    cancelledAt: { type: Date, default: null },
    cancelledBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    cancelReason: { type: String, default: null },
    statusHistory: [statusHistorySchema],
    botMessageIds: {
      buyer: [{ type: Number }],
      seller: [{ type: Number }],
    },
  },
  { timestamps: true }
);

dealSchema.index({ buyer: 1, status: 1 });
dealSchema.index({ seller: 1, status: 1 });
dealSchema.index({ status: 1, createdAt: -1 });

export const Deal = model<IDeal>('Deal', dealSchema);
