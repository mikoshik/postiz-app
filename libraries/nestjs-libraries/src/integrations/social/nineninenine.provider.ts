import {
  AuthTokenDetails,
  PostDetails,
  PostResponse,
  SocialProvider,
} from '@gitroom/nestjs-libraries/integrations/social/social.integrations.interface';
import { SocialAbstract } from '@gitroom/nestjs-libraries/integrations/social.abstract';
import { Integration } from '@prisma/client';
import { makeId } from '@gitroom/nestjs-libraries/services/make.is';
import dayjs from 'dayjs';

export class NineNineNine implements SocialProvider {
  identifier = 'nineninenine';
  name = '999';
  isBetweenSteps = false;
  scopes: string[] = [];
  editor = 'markdown' as const;

  maxLength() {
    return 2000;
  }

  async customFields() {
    return [
      {
        key: 'phoneNumber',
        label: 'Phone Number (Номер телефона)',
        validation: '/^.+$/',
        type: 'text' as const,
      },
      {
        key: 'location',
        label: 'Location (Местоположение)',
        validation: '/^.+$/',
        type: 'text' as const,
      },
    ];
  }

  async generateAuthUrl() {
    const state = makeId(17);
    return {
      url: state,
      codeVerifier: makeId(10),
      state,
    };
  }

  async authenticate(params: {
    code: string;
    codeVerifier: string;
    refresh?: string;
  }): Promise<AuthTokenDetails | string> {
    try {
      const { phoneNumber, location } = JSON.parse(
        Buffer.from(params.code, 'base64').toString()
      );

      // Сохраняем данные пользователя в accessToken (так как API ключ теперь в ENV)
      const tokenData = JSON.stringify({ phoneNumber, location });
      const accessToken = Buffer.from(tokenData).toString('base64');

      return {
        accessToken: accessToken,
        refreshToken: '',
        expiresIn: dayjs().add(100, 'year').unix() - dayjs().unix(),
        id: makeId(10),
        name: `999 User (${phoneNumber})`,
        picture: 'https://999.md/public/images/logo.svg',
        username: phoneNumber,
      } as AuthTokenDetails;
    } catch (err) {
      return (
        'Authentication failed: ' +
        (err instanceof Error ? err.message : String(err))
      );
    }
  }

  async refreshToken(refreshToken: string): Promise<AuthTokenDetails> {
    return {
      accessToken: '',
      refreshToken: '',
      expiresIn: dayjs().add(100, 'year').unix() - dayjs().unix(),
      id: '',
      name: '',
      picture: '',
      username: '',
    };
  }

  // Хелпер для загрузки изображения на 999.md
  private async uploadImage(url: string, apiToken: string): Promise<string> {
    try {
      // 1. Скачиваем изображение
      const imageResponse = await fetch(url);
      if (!imageResponse.ok) throw new Error(`Failed to fetch image: ${url}`);
      const blob = await imageResponse.blob();

      // 2. Формируем FormData
      const formData = new FormData();
      formData.append('file', blob, 'image.jpg');

      // 3. Отправляем на 999.md
      const uploadResponse = await fetch('https://partners-api.999.md/images', {
        method: 'POST',
        headers: {
          Authorization: `Basic ${Buffer.from(`${apiToken}:`).toString('base64')}`,
        },
        body: formData,
      });

      if (!uploadResponse.ok) {
        const text = await uploadResponse.text();
        throw new Error(`Failed to upload image to 999: ${text}`);
      }

      const data = await uploadResponse.json();
      return data.image_id;
    } catch (e) {
      console.error('Image upload error:', e);
      throw e;
    }
  }

  // Заглушка для ИИ парсинга
  private async parseWithAi(text: string): Promise<any> {
    // TODO: Здесь должен быть вызов к OpenAI или другому LLM
    // const completion = await openai.chat.completions.create({ ... });
    
    // Примерные данные которые нужны 999 про машины (JSON заглушка)
    return {
      category_id: '658', // Транспорт
      subcategory_id: '659', // Легковые автомобили
      offer_type: '776', // Продам
      features: [
        { id: '14', value: 'BMW' }, // Марка (пример)
        { id: '15', value: '5 Series' }, // Модель (пример)
        { id: '12', value: '2018' }, // Год выпуска
        { id: '16', value: 'Diesel' }, // Тип топлива
        { id: '18', value: 'Automatic' }, // КПП
      ],
    };
  }

  async post(
    id: string,
    accessToken: string,
    postDetails: PostDetails[],
    integration: Integration
  ): Promise<PostResponse[]> {
    const content = postDetails[0].message;
    
    // Получаем API ключ из ENV
    const apiKey = process.env.NINENINENINE_API_KEY;
    if (!apiKey) {
      throw new Error('NINENINENINE_API_KEY is not set in environment variables');
    }

    // Декодируем данные пользователя из accessToken
    let userData: { phoneNumber: string; location: string };
    try {
      userData = JSON.parse(Buffer.from(accessToken, 'base64').toString());
    } catch (e) {
      throw new Error('Invalid access token format');
    }

    const authHeader = `Basic ${Buffer.from(`${apiKey}:`).toString('base64')}`;
    const settings = postDetails[0].settings || {};

    try {
      // 1. Загружаем все изображения
      const mediaFiles = postDetails[0].media || [];
      const uploadedImageIds: string[] = [];

      for (const media of mediaFiles) {
        // Пропускаем видео, так как 999 API (в этом примере) работает с картинками
        if (media.path.match(/\.(jpg|jpeg|png|webp)$/i)) {
            try {
                const imageId = await this.uploadImage(media.path, apiKey);
                uploadedImageIds.push(imageId);
            } catch (e) {
                console.warn(`Skipping image ${media.path} due to upload error.`);
            }
        }
      }

      // 2. Парсим текст с помощью ИИ (получаем характеристики авто)
      const aiData = await this.parseWithAi(content);

      // 3. Подготавливаем данные объявления
      // Пытаемся извлечь заголовок из первой строки
      const lines = content.split('\n');
      let title = settings.title || lines[0].substring(0, 50); // Максимум 50 символов
      if (title.length === 0) title = 'New Advert';

      // Описание - весь текст
      const description = content;

      // Собираем payload
      const payload = {
        title: title,
        description: description,
        price: {
          value: settings.price ? Number(settings.price) : 0, // Цена по умолчанию, пользователь изменит на сайте
          unit: 'eur',
        },
        ...aiData, // Вставляем данные от ИИ (category, features и т.д.)
        region_id: '12', // Можно использовать userData.location для поиска ID региона
        contacts: {
            phones: [userData.phoneNumber]
        },
        images: uploadedImageIds 
      };

      console.log('Posting to 999.md with AI data:', JSON.stringify(payload, null, 2));

      // 4. Создаем объявление
      const response = await fetch('https://partners-api.999.md/adverts', {
        method: 'POST',
        headers: {
          Authorization: authHeader,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const responseData = await response.json();

      return [
        {
          id: postDetails[0].id,
          status: 'completed',
          postId: responseData.id,
          releaseURL: `https://999.md/ru/${responseData.id}`,
        },
      ];
    } catch (err) {
      console.error('Failed to post to 999:', err);
      return [
        {
          id: postDetails[0].id,
          status: 'failed',
          postId: undefined,
          releaseURL: undefined,
        },
      ];
    }
  }
}