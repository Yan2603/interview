import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type CompanyDocument = HydratedDocument<Company>;

@Schema({ timestamps: true })
export class Company {
  @Prop({ required: true, unique: true })
  name!: string;

  @Prop({ default: 0 })
  order!: number;
}

export const CompanySchema = SchemaFactory.createForClass(Company);
