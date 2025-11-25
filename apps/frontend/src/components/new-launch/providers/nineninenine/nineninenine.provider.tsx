'use client';

import React, { FC } from 'react';
import {
  PostComment,
  withProvider,
} from '@gitroom/frontend/components/new-launch/providers/high.order.provider';
import { useSettings } from '@gitroom/frontend/components/launches/helpers/use.values';
import { Input } from '@gitroom/react/form/input';

// КОМПОНЕНТ НАСТРОЕК (Вкладка настроек канала при создании поста)
const NineNineNineSettings: FC = () => {
  const { register } = useSettings();

  return (
    <div className="flex flex-col gap-4">
       <div className="text-white">
         <h3 className="text-lg font-bold">Настройки объявления 999.md</h3>
       </div>

       <Input
         label="Заголовок (Title)"
         placeholder="Заголовок объявления (если пусто, берется из текста)"
         {...register('title')}
       />
       
       <Input
         label="Цена (EUR)"
         placeholder="Цена в евро"
         type="number"
         {...register('price')}
       />
    </div>
  );
};

// ЭКСПОРТ
export default withProvider({
  postComment: PostComment.COMMENT,
  minimumCharacters: [],
  SettingsComponent: NineNineNineSettings,
  CustomPreviewComponent: undefined,
  dto: undefined,
  checkValidity: async () => true,
  maximumCharacters: 2000,
});