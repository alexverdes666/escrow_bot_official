import { Schema, model, Document, Types } from 'mongoose';

export interface IAuditLog extends Document {
  action: string;
  performedBy: Types.ObjectId;
  targetDeal?: Types.ObjectId;
  targetUser?: Types.ObjectId;
  targetDispute?: Types.ObjectId;
  details?: Record<string, unknown>;
  createdAt: Date;
}

const auditLogSchema = new Schema<IAuditLog>(
  {
    action: {
      type: String,
      enum: [
        'deal_created', 'deal_agreed', 'deal_rejected',
        'payment_confirmed', 'deal_delivered', 'deal_completed',
        'deal_cancelled', 'dispute_opened', 'dispute_resolved',
        'user_banned', 'user_unbanned', 'admin_action',
      ],
      required: true,
    },
    performedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    targetDeal: { type: Schema.Types.ObjectId, ref: 'Deal' },
    targetUser: { type: Schema.Types.ObjectId, ref: 'User' },
    targetDispute: { type: Schema.Types.ObjectId, ref: 'Dispute' },
    details: { type: Schema.Types.Mixed },
  },
  { timestamps: true }
);

auditLogSchema.index({ createdAt: -1 });
auditLogSchema.index({ performedBy: 1 });

export const AuditLog = model<IAuditLog>('AuditLog', auditLogSchema);
