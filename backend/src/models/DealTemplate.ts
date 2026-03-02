import { Schema, model, Document } from 'mongoose';

export interface IDealTemplate extends Document {
  name: string;
  slug: string;
  description: string;
  emoji: string;
  isActive: boolean;
  sortOrder: number;
  defaultTerms: {
    paymentType: string;
    depositPercent?: number;
    autoReleaseDays: number;
    disputeWindowDays: number;
    deliveryDeadlineDays?: number;
    buyerObligations?: string;
    sellerObligations?: string;
    customConditions?: string[];
  };
  createdAt: Date;
  updatedAt: Date;
}

const dealTemplateSchema = new Schema<IDealTemplate>(
  {
    name: { type: String, required: true, unique: true },
    slug: { type: String, required: true, unique: true },
    description: { type: String, required: true },
    emoji: { type: String, default: '📋' },
    isActive: { type: Boolean, default: true },
    sortOrder: { type: Number, default: 0 },
    defaultTerms: {
      paymentType: { type: String, required: true },
      depositPercent: { type: Number },
      autoReleaseDays: { type: Number, default: 3 },
      disputeWindowDays: { type: Number, default: 3 },
      deliveryDeadlineDays: { type: Number },
      buyerObligations: { type: String },
      sellerObligations: { type: String },
      customConditions: [{ type: String }],
    },
  },
  { timestamps: true }
);

export const DealTemplate = model<IDealTemplate>('DealTemplate', dealTemplateSchema);
