import {
    AuthTokenDetails,
    PostDetails,
    PostResponse,
    SocialProvider,
  } from '@gitroom/nestjs-libraries/integrations/social/social.integrations.interface';
  

  export class NineNineNine implements SocialProvider {
    // ВАЖНО: Это имя должно точь-в-точь совпадать с тем, что ты писал в DTO (шаг назад)
    identifier = 'ninenine'; 
    // Это имя увидит пользователь в меню
    name = '999'; 
    isBetweenSteps = false; // Нужен ли промежуточный шаг (обычно нет)
    scopes: string[] = [];            // Права доступа (пока пустой массив)
    maxLength = () => 2000;           // Лимит символов для поста
    editor: 'normal' = 'normal';      // Редактор в допустимом формате
  
    // 1. Метод для авторизации (генерация ссылки)
    async generateAuthUrl() {
        // Вместо просто return 'https://...' нужно вернуть объект
        return {
          url: 'https://google.com', // Твоя ссылка авторизации
          codeVerifier: 'random_string', // Строка для проверки (нужна для OAuth, пока можно заглушку)
          state: 'random_state' // Состояние (тоже для OAuth)
        };
      }
  
    // 2. Метод обработки входа (получение токенов)
    async authenticate(params: { code: string; codeVerifier: string }) {
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
    }
  
    // 3. Обновление токена (если он протух)
    async refreshToken(refreshToken: string): Promise<AuthTokenDetails> {
      return {
        accessToken: 'new-fake-token',
        refreshToken: refreshToken,
      } as AuthTokenDetails;
    }
  
    // 4. САМОЕ ГЛАВНОЕ: Публикация поста
    async post(
      id: string,
      accessToken: string,
      postDetails: PostDetails[]
    ): Promise<PostResponse[]> {
      
      const content = postDetails[0].message; // Текст поста
      console.log('Я пытаюсь отправить пост:', content);
  
      // ЗДЕСЬ БУДЕТ ТВОЙ КОД ОТПРАВКИ В API
      // Например: await axios.post('https://api.myservice.com/post', { text: content })
  
      // Возвращаем успех
      return [
        {
          id: 'new-post-id-123',                    // ID в системе Postiz
          postId: 'new-post-id-123',                // ID созданного поста в той системе
          status: 'posted',                         // Статус
          releaseURL: 'https://myservice.com/post/123', // Ссылка на пост
        },
      ];
    }
  }