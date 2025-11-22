import { IsIn } from 'class-validator';

export class NinenineDto {
  @IsIn(['ninenine'])
  __type: 'ninenine';
}