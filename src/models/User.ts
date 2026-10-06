import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";

const userSchema = new Schema(
  {
    // Stored lowercase, so login is case-insensitive.
    username: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    /** Other people's shared GPTs this user opened, shown in their sidebar. */
    sharedGpts: { type: [{ type: Schema.Types.ObjectId, ref: "Gpt" }], default: [] },
  },
  { timestamps: true },
);

export type UserDoc = InferSchemaType<typeof userSchema>;

export const User: Model<UserDoc> = models.User ?? model<UserDoc>("User", userSchema);
