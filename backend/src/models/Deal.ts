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

// Crypto payment sub-schema
const cryptoPaymentSchema = new Schema({
  chain: { type: String, enum: ['ETH', 'BTC', 'TRON'], required: true },
  token: { type: String, enum: ['TRX', 'USDT'] },
  network: { type: String, enum: ['testnet', 'mainnet'], required: true },
  depositAddress: { type: String, default: '' },
  derivationIndex: { type: Number, default: 0 },
  buyerAddress: { type: String, default: '' },
  sellerAddress: { type: String, default: '' },
  expectedAmount: { type: String, required: true },
  expectedAmountHuman: { type: String, required: true },
  receivedAmount: { type: String },
  depositTxHash: { type: String },
  confirmations: { type: Number, default: 0 },
  fundedAt: { type: Date },
  releaseTxHash: { type: String },
  releasedAt: { type: Date },
  refundTxHash: { type: String },
  platformFeeAmount: { type: String },
  platformFeeTxHash: { type: String },
  status: {
    type: String,
    enum: ['pending', 'detected', 'confirmed', 'released', 'refunded'],
    default: 'pending',
  },
}, { _id: false });

// Attachment sub-schema
const attachmentSchema = new Schema({
  fileId: { type: String, required: true },
  fileUniqueId: { type: String, required: true },
  fileType: { type: String, enum: ['photo', 'document'], required: true },
  fileName: { type: String },
  mimeType: { type: String },
  fileSize: { type: Number },
  uploadedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  uploadedAt: { type: Date, default: Date.now },
  caption: { type: String },
  dealStage: { type: String },
}, { _id: true });

// Deliverable sub-schema
const deliverableSchema = new Schema({
  fileId: { type: String, required: true },
  fileUniqueId: { type: String, required: true },
  fileType: { type: String, enum: ['photo', 'document'], required: true },
  fileName: { type: String },
  mimeType: { type: String },
  fileSize: { type: Number },
  uploadedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  uploadedAt: { type: Date, default: Date.now },
  caption: { type: String },
}, { _id: true });

const deliverableReviewSchema = new Schema({
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
  reviewedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  reviewedAt: { type: Date },
  rejectionReason: { type: String },
  submittedAt: { type: Date, default: Date.now },
}, { _id: false });

// Deal statuses
export const DEAL_STATUSES = [
  'draft',
  'pending_agreement',
  'active',
  'awaiting_deposit',
  'funded',
  'payment_confirmed',
  'pending_review',
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

export type CryptoChain = 'ETH' | 'BTC' | 'TRON';
export type CryptoToken = 'TRX' | 'USDT';
export type CryptoPaymentStatus = 'pending' | 'detected' | 'confirmed' | 'released' | 'refunded';

export interface ICryptoPayment {
  chain: CryptoChain;
  token?: CryptoToken;
  network: 'testnet' | 'mainnet';
  depositAddress: string;
  derivationIndex: number;
  buyerAddress: string;
  sellerAddress: string;
  expectedAmount: string;
  expectedAmountHuman: string;
  receivedAmount?: string;
  depositTxHash?: string;
  confirmations: number;
  fundedAt?: Date;
  releaseTxHash?: string;
  releasedAt?: Date;
  refundTxHash?: string;
  platformFeeAmount?: string;
  platformFeeTxHash?: string;
  status: CryptoPaymentStatus;
}

export interface IDeliverable {
  _id?: Types.ObjectId;
  fileId: string;
  fileUniqueId: string;
  fileType: 'photo' | 'document';
  fileName?: string;
  mimeType?: string;
  fileSize?: number;
  uploadedBy: Types.ObjectId;
  uploadedAt: Date;
  caption?: string;
}

export interface IDeliverableReview {
  status: 'pending' | 'approved' | 'rejected';
  reviewedBy?: Types.ObjectId;
  reviewedAt?: Date;
  rejectionReason?: string;
  submittedAt: Date;
}

export interface IAttachment {
  _id?: Types.ObjectId;
  fileId: string;
  fileUniqueId: string;
  fileType: 'photo' | 'document';
  fileName?: string;
  mimeType?: string;
  fileSize?: number;
  uploadedBy: Types.ObjectId;
  uploadedAt: Date;
  caption?: string;
  dealStage: string;
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
  cryptoPayment?: ICryptoPayment;
  botMessageIds: {
    buyer: number[];
    seller: number[];
  };
  attachments: IAttachment[];
  deliverables: IDeliverable[];
  deliverableReview?: IDeliverableReview;
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
    cryptoPayment: { type: cryptoPaymentSchema, default: undefined },
    statusHistory: [statusHistorySchema],
    botMessageIds: {
      buyer: [{ type: Number }],
      seller: [{ type: Number }],
    },
    attachments: [attachmentSchema],
    deliverables: [deliverableSchema],
    deliverableReview: { type: deliverableReviewSchema, default: undefined },
  },
  { timestamps: true }
);

dealSchema.index({ buyer: 1, status: 1 });
dealSchema.index({ seller: 1, status: 1 });
dealSchema.index({ status: 1, createdAt: -1 });
dealSchema.index({ 'cryptoPayment.status': 1, status: 1 });

export const Deal = model<IDeal>('Deal', dealSchema);
