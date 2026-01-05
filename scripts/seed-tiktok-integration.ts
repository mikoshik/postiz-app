// pnpm exec ts-node scripts/seed-tiktok-integration.ts ЗАПУСК 
import { PrismaClient } from '@prisma/client';
import * as Sentry from '@sentry/node';

const prisma = new PrismaClient();
const { logger } = Sentry;

async function seedTikTokIntegration() {
  try {
    // Находим первую доступную организацию
    const org = await prisma.organization.findFirst({
      orderBy: { createdAt: 'desc' },
    });

    if (!org) {
      logger.error('No organizations found in database');
      console.error('❌ В базе данных нет организаций');
      console.log('💡 Сначала зарегистрируйтесь через UI: http://localhost:4200');
      return;
    }

    logger.info('Found organization', { 
      organizationId: org.id,
      name: org.name 
    });
    console.log('✅ Найдена организация:', { id: org.id, name: org.name });

    // Проверяем, нет ли уже TikTok интеграции для этой организации
    const existingTikTok = await prisma.integration.findFirst({
      where: {
        organizationId: org.id,
        providerIdentifier: 'tiktok',
        deletedAt: null,
      },
    });

    if (existingTikTok) {
      logger.warn('TikTok integration already exists', {
        integrationId: existingTikTok.id,
        internalId: existingTikTok.internalId,
      });
      console.log('⚠️ TikTok интеграция уже существует:', {
        id: existingTikTok.id,
        internalId: existingTikTok.internalId,
        name: existingTikTok.name,
        profile: existingTikTok.profile,
      });
      return;
    }

    // Генерируем уникальный internalId
    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substring(7);
    const internalId = `tiktok_${timestamp}_${randomStr}`;
    
    // Создаем TikTok интеграцию
    const integration = await prisma.integration.create({
      data: {
        internalId,
        organizationId: org.id,
        name: 'Fake TikTok Test Account',
        picture: 'https://p16-sign-va.tiktokcdn.com/tos-maliva-avt-0068/default~c5_100x100.jpeg',
        providerIdentifier: 'tiktok',
        type: 'social',
        token: `fake_tiktok_access_${timestamp}`,
        disabled: false,
        tokenExpiration: new Date(Date.now() + 23 * 60 * 60 * 1000), // +23 часа
        refreshToken: `fake_tiktok_refresh_${timestamp}`,
        profile: `test_tiktok_user_${randomStr}`,
        inBetweenSteps: false,
        refreshNeeded: false,
        postingTimes: '[{"time":120}, {"time":400}, {"time":700}]',
        additionalSettings: '[]',
      },
    });

    logger.info('TikTok integration created successfully', { 
      integrationId: integration.id,
      internalId: integration.internalId,
      organizationId: org.id,
    });
    
    console.log('✅ TikTok интеграция успешно создана:');
    console.log({
      id: integration.id,
      internalId: integration.internalId,
      name: integration.name,
      profile: integration.profile,
      providerIdentifier: integration.providerIdentifier,
      disabled: integration.disabled,
      organizationId: integration.organizationId,
      createdAt: integration.createdAt,
    });

  } catch (error) {
    logger.error('Failed to create TikTok integration', { error });
    console.error('❌ Ошибка при создании интеграции:', error);
    if (error instanceof Error) {
      console.error('Детали ошибки:', error.message);
      console.error('Stack trace:', error.stack);
    }
  } finally {
    await prisma.$disconnect();
  }
}

// Запуск скрипта
seedTikTokIntegration()
  .then(() => {
    console.log('\n✅ Скрипт завершен');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Критическая ошибка:', error);
    process.exit(1);
  });

