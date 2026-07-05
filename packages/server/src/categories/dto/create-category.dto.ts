import { IsString, IsNotEmpty, IsOptional, MaxLength } from 'class-validator';

export class CreateCategoryDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(50, { message: 'slug 不能超过 50 字符' })
  slug!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(50, { message: '分类名称不能超过 50 字符' })
  name!: string;

  @IsOptional()
  order?: number;
}
