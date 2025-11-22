'use client';

import React, { FC } from 'react';
import {
  PostComment,
  withProvider,
} from '@gitroom/frontend/components/new-launch/providers/high.order.provider';

// КОМПОНЕНТ НАСТРОЕК (Вкладка настроек канала)
const NineNineNineSettings: FC = () => {
  // Здесь пока пусто, так как у нас нет сложных настроек
  return (
    <div className="flex flex-col gap-4">
       <div className="text-sm text-gray-400">
         Для этого провайдера нет особых настроек. Просто публикуй!
       </div>
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
  checkValidity: undefined,
  maximumCharacters: 1000,
});