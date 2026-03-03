import { Schema, model, Document, Types } from 'mongoose';

export interface IEvidence {
  submittedBy: Types.ObjectId;
  type: 'text' | 'image' | 'document' | 'link';
  content: string;
  fileName?: string;
  fileUniqueId?: string;
  mimeType?: string;
  fileSize?: number;
  submittedAt: Date;
}

export interface IDisputeMessage {
  author: Types.ObjectId;
  authorRole: 'buyer' | 'seller' | 'admin';
  message: string;
  createdAt: Date;
}

export interface IDispute extends Document {
  deal: Types.ObjectId;
  dealId: string;
  openedBy: Types.ObjectId;
  openedByRole: 'buyer' | 'seller';
  reason: string;
  status: 'open' | 'under_review' | 'resolved' | 'closed';
  evidence: IEvidence[];
  messages: IDisputeMessage[];
  resolution: {
    decidedBy?: Types.ObjectId;
    decision?: 'release_to_seller' | 'refund_to_buyer' | 'split' | 'custom';
    splitPercent?: {
      buyer: number;
      seller: number;
    };
    explanation?: string;
    decidedAt?: Date;
  };
  resolvedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const evidenceSchema = new Schema({
  submittedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  type: { type: String, enum: ['text', 'image', 'document', 'link'], required: true },
  content: { type: String, required: true },
  fileName: { type: String },
  fileUniqueId: { type: String },
  mimeType: { type: String },
  fileSize: { type: Number },
  submittedAt: { type: Date, default: Date.now },
}, { _id: true });

const disputeMessageSchema = new Schema({
  author: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  authorRole: { type: String, enum: ['buyer', 'seller', 'admin'], required: true },
  message: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
}, { _id: true });

const disputeSchema = new Schema<IDispute>(
  {
    deal: { type: Schema.Types.ObjectId, ref: 'Deal', required: true, index: true },
    dealId: { type: String, required: true },
    openedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    openedByRole: { type: String, enum: ['buyer', 'seller'], required: true },
    reason: { type: String, required: true },
    status: {
      type: String,
      enum: ['open', 'under_review', 'resolved', 'closed'],
      default: 'open',
      index: true,
    },
    evidence: [evidenceSchema],
    messages: [disputeMessageSchema],
    resolution: {
      decidedBy: { type: Schema.Types.ObjectId, ref: 'User' },
      decision: {
        type: String,
        enum: ['release_to_seller', 'refund_to_buyer', 'split', 'custom'],
      },
      splitPercent: {
        buyer: { type: Number },
        seller: { type: Number },
      },
      explanation: { type: String },
      decidedAt: { type: Date },
    },
    resolvedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

export const Dispute = model<IDispute>('Dispute', disputeSchema);
