import { IsString, IsOptional, IsEnum, IsArray, MaxLength } from 'class-validator';
import { Mastery } from '../question.schema';

export class UpdateQuestionDto {
  @IsString()
  @IsOptional()
  @MaxLength(200, { message: '题目标题不能超过 200 字符' })
  title?: string;

  @IsString()
  @IsOptional()
  categorySlug?: string;

  @IsString()
  @IsOptional()
  @MaxLength(5000, { message: '题目描述不能超过 5000 字符' })
  content?: string;

  @IsString()
  @IsOptional()
  @MaxLength(10000, { message: '笔记不能超过 10000 字符' })
  myNotes?: string;

  @IsString()
  @IsOptional()
  @MaxLength(20000, { message: 'AI 答案不能超过 20000 字符' })
  aiAnswer?: string;

  @IsEnum(['new', 'reviewing', 'mastered'])
  @IsOptional()
  mastery?: Mastery;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  tags?: string[];
}
