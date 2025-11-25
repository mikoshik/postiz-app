import { IsIn, IsOptional, IsString } from 'class-validator';

export class NinenineDto {
  @IsIn(['nineninenine'])
  __type: 'nineninenine';

  @IsString()
  @IsOptional()
  apiKey?: string;

  @IsString()
  @IsOptional()
  title?: string;

  @IsString()
  @IsOptional()
  price?: string;
}