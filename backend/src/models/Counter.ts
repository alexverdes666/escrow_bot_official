import { Schema, model, Document } from 'mongoose';

export interface ICounter extends Document {
  name: string;
  value: number;
}

const counterSchema = new Schema<ICounter>({
  name: { type: String, required: true, unique: true },
  value: { type: Number, required: true, default: 0 },
});

export const Counter = model<ICounter>('Counter', counterSchema);

export async function getNextDerivationIndex(): Promise<number> {
  const counter = await Counter.findOneAndUpdate(
    { name: 'dealCryptoIndex' },
    { $inc: { value: 1 } },
    { upsert: true, new: true }
  );
  return counter.value;
}
