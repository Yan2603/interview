import { IsString, IsNotEmpty, IsOptional, IsArray, MaxLength } from 'class-validator';

export class CreateQuestionDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200, { message: '题目标题不能超过 200 字符' })
  title!: string;

  @IsString()
  @IsNotEmpty()
  categorySlug!: string;

  @IsString()
  @IsOptional()
  @MaxLength(5000, { message: '题目描述不能超过 5000 字符' })
  content?: string;

  @IsString()
  @IsOptional()
  @MaxLength(10000, { message: '笔记不能超过 10000 字符' })
  myNotes?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  tags?: string[];
}
