import {
    AuthTokenDetails,
    PostDetails,
    PostResponse,
    SocialProvider,
  } from '@gitroom/nestjs-libraries/integrations/social/social.integrations.interface';
import { SocialAbstract } from '@gitroom/nestjs-libraries/integrations/social.abstract';
import { Integration } from '@prisma/client';
import { makeId } from '@gitroom/nestjs-libraries/services/make.is';

export class NineNineNine extends SocialAbstract implements SocialProvider {
  // ВАЖНО: Это имя должно точь-в-точь совпадать с тем, что ты писал в DTO (шаг назад)
  identifier = 'ninenine'; 
  // Это имя увидит пользователь в меню
  name = '999'; 
  isBetweenSteps = false; // Нужен ли промежуточный шаг (обычно нет)
  scopes: string[] = [];
  editor = 'markdown' as const;            // Права доступа (пока пустой массив)
  
  maxLength() {
    return 2000;           // Лимит символов для поста
  }

  // 1. Метод для авторизации (генерация ссылки)
  async generateAuthUrl() {
    const state = makeId(6);
    return {
      url: 'https://google.com', // Твоя ссылка авторизации
      codeVerifier: makeId(10), // Строка для проверки (нужна для OAuth, пока можно заглушку)
      state // Состояние (тоже для OAuth)
    };
  }

  // 2. Метод обработки входа (получение токенов)
  async authenticate(params: { code: string; codeVerifier: string; refresh?: string }): Promise<AuthTokenDetails | string> {
    try {
      // Тут логика обмена кода на токен доступа
      return {
        accessToken: 'fake-token',
        refreshToken: 'fake-refresh-token',
        expiresIn: 3600,
        id: 'user-id-from-provider',
        name: 'User Name',
        picture: 'https://via.placeholder.com/150', // Аватарка
        username: 'username',
      } as AuthTokenDetails;
    } catch (err) {
      return 'Authentication failed';
    }
  }

  // 3. Обновление токена (если он протух)
  async refreshToken(refreshToken: string): Promise<AuthTokenDetails> {
    return {
      accessToken: 'new-fake-token',
      refreshToken: refreshToken,
      expiresIn: 3600,
      id: 'user-id-from-provider',
      name: 'User Name',
      picture: 'https://via.placeholder.com/150',
      username: 'username',
    } as AuthTokenDetails;
  }

  // 4. САМОЕ ГЛАВНОЕ: Публикация поста
  async post(
    id: string,
    accessToken: string,
    postDetails: PostDetails[],
    integration: Integration
  ): Promise<PostResponse[]> {
    
    const content = postDetails[0].message; // Текст поста
    console.log('Я пытаюсь отправить пост:', content);

    try {
      // ЗДЕСЬ БУДЕТ ТВОЙ КОД ОТПРАВКИ В API
      // Например: await axios.post('https://api.myservice.com/post', { text: content })

      // Возвращаем успех
      return [
        {
          id: postDetails[0].id,                    // ID в системе Postiz
          status: 'completed',                      // Статус: 'completed' | 'failed'
          postId: 'new-post-id-123',                // ID созданного поста в той системе
          releaseURL: 'https://myservice.com/post/123', // Ссылка на пост
        },
      ];
    } catch (err) {
      // При ошибке возвращаем failed статус без поля error
      return [
        {
          id: postDetails[0].id,
          status: 'failed',
          // Можно добавить postId как пустую строку или undefined при ошибке
          postId: undefined,
          releaseURL: undefined,
        },
      ];
    }
  }
}