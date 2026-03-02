import { Schema, model, Document } from 'mongoose';

export interface IUser extends Document {
  telegramId: number;
  username?: string;
  firstName: string;
  lastName?: string;
  photoUrl?: string;
  role: 'user' | 'admin';
  reputation: {
    score: number;
    completedDeals: number;
    disputesWon: number;
    disputesLost: number;
    disputesTotal: number;
  };
  isBanned: boolean;
  banReason?: string;
  lastActiveAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<IUser>(
  {
    telegramId: { type: Number, required: true, unique: true, index: true },
    username: { type: String, sparse: true, index: true },
    firstName: { type: String, required: true },
    lastName: { type: String },
    photoUrl: { type: String },
    role: { type: String, enum: ['user', 'admin'], default: 'user' },
    reputation: {
      score: { type: Number, default: 100 },
      completedDeals: { type: Number, default: 0 },
      disputesWon: { type: Number, default: 0 },
      disputesLost: { type: Number, default: 0 },
      disputesTotal: { type: Number, default: 0 },
    },
    isBanned: { type: Boolean, default: false },
    banReason: { type: String },
    lastActiveAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

export const User = model<IUser>('User', userSchema);
