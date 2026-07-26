import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class SendMessageDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(4000, { message: '消息内容不能超过 4000 字符' })
  content!: string;
}
