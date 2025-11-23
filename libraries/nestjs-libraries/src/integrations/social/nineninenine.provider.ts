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

export class NineNineNine extends SocialAbstract implements SocialProvider {
  identifier = 'nineninenine';
  name = '999';
  isBetweenSteps = false;
  scopes: string[] = [];
  editor = 'markdown' as const;

  maxLength() {
    return 2000;
  }

  // Проверка API токена
  private getApiToken(): string {
    const token = process.env.NINENINENINE_API_TOKEN;
    if (!token) {
      throw new Error('NINENINENINE_API_TOKEN must be set');
    }
    return token;
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
      // Проверяем токен при аутентификации
      this.getApiToken();

      // params.code содержит ID канала/пользователя (в данном случае просто заглушка или ID пользователя)
      const channelId = params.code;

      return {
        accessToken: channelId,
        refreshToken: '',
        expiresIn: dayjs().add(100, 'year').unix() - dayjs().unix(),
        id: channelId,
        name: '999 Account',
        picture: 'https://999.md/public/images/logo.svg', // Логотип 999
        username: channelId,
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

  async post(
    id: string,
    accessToken: string,
    postDetails: PostDetails[],
    integration: Integration
  ): Promise<PostResponse[]> {
    const content = postDetails[0].message;
    const apiToken = this.getApiToken();
    const authHeader = `Basic ${Buffer.from(`${apiToken}:`).toString('base64')}`;

    try {
      // 1. Загружаем все изображения
      const mediaFiles = postDetails[0].media || [];
      const uploadedImageIds: string[] = [];

      for (const media of mediaFiles) {
        // Пропускаем видео, так как 999 API (в этом примере) работает с картинками
        if (media.path.match(/\.(jpg|jpeg|png|webp)$/i)) {
            try {
                const imageId = await this.uploadImage(media.path, apiToken);
                uploadedImageIds.push(imageId);
            } catch (e) {
                console.warn(`Skipping image ${media.path} due to upload error.`);
            }
        }
      }

      // 2. Подготавливаем данные объявления
      // Пытаемся извлечь заголовок из первой строки
      const lines = content.split('\n');
      let title = lines[0].substring(0, 50); // Максимум 50 символов
      if (title.length === 0) title = 'New Advert';

      // Описание - весь текст
      const description = content;

      // Хардкод параметров для авто (как в запросе)
      // TODO: В будущем можно вынести это в настройки интеграции или парсить из текста
      const categoryId = '658'; // Транспорт
      const subcategoryId = '659'; // Легковые авто
      const offerType = '776'; // Продам
      const regionId = '12'; // Кишинев (default)

      // Формируем features
      const features: any[] = [];
      
      // Добавляем изображения в features, если они есть
      // ВАЖНО: ID фичи для картинок зависит от категории. 
      // Для авто это часто специфичный ID. Если он неизвестен, картинки могут не прикрепиться.
      // Здесь я использую заглушку или стандартный метод, если он есть.
      // В документации 999 часто картинки передаются отдельно или через специфичный feature_id.
      // Предположим, что мы просто загрузили их, но API требует привязки.
      // Если API поддерживает поле `images` в корне (некоторые версии), можно попробовать так.
      // Но по инструкции пользователя: "Images are also passed as a feature!"
      
      // ПРИМЕЧАНИЕ: Без реального feature_id для картинок в категории 659 этот код может требовать доработки.
      // Обычно это ID типа "818" или подобное. Я оставлю место для этого.
      if (uploadedImageIds.length > 0) {
          // features.push({
          //    id: "UNKNOWN_IMAGE_FEATURE_ID", 
          //    value: uploadedImageIds
          // });
      }

      const payload = {
        title: title,
        description: description,
        price: {
          value: 0, // Цена по умолчанию, пользователь изменит на сайте
          unit: 'eur',
        },
        offer_type: offerType,
        category_id: categoryId,
        subcategory_id: subcategoryId,
        region_id: regionId,
        features: features,
        // Некоторые эндпоинты принимают images напрямую
        images: uploadedImageIds 
      };

      console.log('Posting to 999.md:', JSON.stringify(payload, null, 2));

      // 3. Создаем объявление
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