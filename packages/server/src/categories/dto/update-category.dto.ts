import { IsString, IsNotEmpty, MaxLength } from 'class-validator';

export class UpdateCategoryDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(50, { message: '分类名称不能超过 50 字符' })
  name!: string;
}
