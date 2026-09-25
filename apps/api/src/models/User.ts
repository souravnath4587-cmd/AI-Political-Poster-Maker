import mongoose, { Schema, type HydratedDocument, type InferSchemaType } from 'mongoose';
import { userPlanSchema, userRoleSchema, type AuthUser } from '@app/shared';

const userSchema = new Schema(
  {
    /** E.164, e.g. +8801712345678. */
    phone: { type: String, required: true, unique: true },
    isVerified: { type: Boolean, default: false },
    role: { type: String, enum: userRoleSchema.options, default: 'user' },
    plan: { type: String, enum: userPlanSchema.options, default: 'free' },
    /** Premium ends at this time; null = no end date. */
    planExpiresAt: { type: Date, default: null },
    /** Set on the first login, when the user accepts the terms of use. */
    acceptedTermsAt: { type: Date, default: null },
    lastLoginAt: { type: Date, default: null },
  },
  { timestamps: true },
);

export type UserDoc = InferSchemaType<typeof userSchema> & { _id: mongoose.Types.ObjectId };
export type UserDocument = HydratedDocument<InferSchemaType<typeof userSchema>>;
export const User = mongoose.model('User', userSchema);

/** Premium counts only until planExpiresAt; checked on every request, no cron job needed. */
export function effectivePlan(
  user: Pick<UserDoc, 'plan' | 'planExpiresAt'>,
  now = new Date(),
): AuthUser['plan'] {
  if (user.plan !== 'premium') return 'free';
  return !user.planExpiresAt || user.planExpiresAt > now ? 'premium' : 'free';
}

export function toAuthUser(user: UserDoc): AuthUser {
  return {
    id: user._id.toString(),
    phone: user.phone,
    role: user.role,
    plan: effectivePlan(user),
    planExpiresAt: user.planExpiresAt ? user.planExpiresAt.toISOString() : null,
  };
}
