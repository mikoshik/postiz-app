'use client';

import React, { FC, useEffect, useState, useCallback } from 'react';
import {
  PostComment,
  withProvider,
} from '@gitroom/frontend/components/new-launch/providers/high.order.provider';
import { useSettings } from '@gitroom/frontend/components/launches/helpers/use.values';
import { useIntegration } from '@gitroom/frontend/components/launches/helpers/use.integration';

// ==========================================
// 1. ТИПЫ И ИНТЕРФЕЙСЫ
// ==========================================

interface FeatureOption {
  id: string;
  title: string;
}

interface Feature {
  id: string;
  title: string;
  type: string;
  required: boolean;
  options: FeatureOption[] | null;
  units: string[] | null;
  label: string;
  label_id: string;
}

interface FeatureGroup {
  title: string;
  features: Feature[];
}

interface PostConfigResponse {
  features_groups: FeatureGroup[];
}

// ==========================================
// ГЛОБАЛЬНОЕ СОСТОЯНИЕ ПАРСИНГА
// ==========================================
const globalParseState = {
  isParsed: false,
  featuresGroups: [] as FeatureGroup[],
  lastParsedText: '',
};

// Функция парсинга текста через API
const parseTextWithAI = async (text: string): Promise<PostConfigResponse> => {
  const response = await fetch('http://localhost:8000/api/post-config', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  return response.json();
};

// ==========================================
// ФУНКЦИЯ ВАЛИДАЦИИ ПЕРЕД ОТПРАВКОЙ
// ==========================================
const checkNineNineNineValidity = async (
  _media: Array<Array<{ path: string; thumbnail?: string }>>,
  settings: any,
  _additionalSettings: any
): Promise<string | true> => {
  console.log('[checkValidity] Called!');
  console.log('[checkValidity] globalParseState.isParsed:', globalParseState.isParsed);
  console.log('[checkValidity] globalParseState.featuresGroups:', globalParseState.featuresGroups.length);
  console.log('[checkValidity] settings:', settings);

  // 1. Проверяем, был ли парсинг
  if (!globalParseState.isParsed) {
    console.log('[checkValidity] BLOCKED: isParsed is false');
    return 'Сначала запустите AI парсинг объявления';
  }

  // 2. Проверяем обязательные динамические поля
  const missingFields: string[] = [];

  globalParseState.featuresGroups.forEach((group) => {
    group.features.forEach((feature) => {
      if (feature.required) {
        const fieldName = `feature_${feature.id}`;
        const value = settings[fieldName];
        if (!value || value === '') {
          missingFields.push(feature.title);
        }
      }
    });
  });

  if (missingFields.length > 0) {
    const displayFields = missingFields.slice(0, 3).join(', ');
    const more = missingFields.length > 3 ? ` и ещё ${missingFields.length - 3}` : '';
    console.log('[checkValidity] BLOCKED: Missing fields:', missingFields);
    return `Заполните обязательные поля: ${displayFields}${more}`;
  }

  // 3. Проверяем статические обязательные поля
  if (!settings.regionId) {
    console.log('[checkValidity] BLOCKED: No regionId');
    return 'Выберите регион';
  }

  console.log('[checkValidity] PASSED! All checks OK');
  return true;
};

// Статические данные для полей которые не приходят из API
const REGIONS = [
  { id: '12', name: 'Кишинев' },
  { id: '16', name: 'Бельцы' },
  { id: '19', name: 'Комрат' },
  { id: '18', name: 'Кагул' },
  { id: '29', name: 'Оргеев' },
  { id: '35', name: 'Тирасполь' },
  { id: '14', name: 'Другой / Вся Молдова' },
];

// ==========================================
// 2. КОМПОНЕНТЫ ДЛЯ РАЗНЫХ ТИПОВ ПОЛЕЙ
// ==========================================

// Dropdown (drop_down_options)
const DropdownField: FC<{
  feature: Feature;
  register: any;
}> = ({ feature, register }) => {
  const fieldName = `feature_${feature.id}`;
  
  return (
    <div>
      <label className="block text-xs font-medium text-gray-300 mb-1">
        {feature.title} {feature.required && <span className="text-red-500">*</span>}
      </label>
      <select
        {...register(fieldName)}
        className="w-full bg-input border border-gray-700 rounded h-10 px-2 text-sm focus:outline-none"
      >
        <option value="">Выберите...</option>
        {feature.options?.map((opt) => (
          <option key={opt.id} value={opt.id}>
            {opt.title}
          </option>
        ))}
      </select>
    </div>
  );
};

// Текстовое поле (textbox_text)
const TextboxField: FC<{
  feature: Feature;
  register: any;
}> = ({ feature, register }) => {
  const fieldName = `feature_${feature.id}`;
  
  return (
    <div>
      <label className="block text-xs font-medium text-gray-300 mb-1">
        {feature.title} {feature.required && <span className="text-red-500">*</span>}
      </label>
      <input
        {...register(fieldName)}
        type="text"
        placeholder={feature.title}
        className="w-full bg-input border border-gray-700 rounded h-10 px-3 text-sm focus:outline-none"
      />
    </div>
  );
};

// Числовое поле (textbox_numeric)
const NumericField: FC<{
  feature: Feature;
  register: any;
}> = ({ feature, register }) => {
  const fieldName = `feature_${feature.id}`;
  
  return (
    <div>
      <label className="block text-xs font-medium text-gray-300 mb-1">
        {feature.title} {feature.required && <span className="text-red-500">*</span>}
      </label>
      <input
        {...register(fieldName)}
        type="number"
        placeholder={feature.title}
        className="w-full bg-input border border-gray-700 rounded h-10 px-3 text-sm focus:outline-none"
      />
    </div>
  );
};

// Числовое поле с единицами измерения (textbox_numeric_measurement)
const NumericMeasurementField: FC<{
  feature: Feature;
  register: any;
}> = ({ feature, register }) => {
  const fieldName = `feature_${feature.id}`;
  const unitFieldName = `feature_${feature.id}_unit`;
  
  return (
    <div>
      <label className="block text-xs font-medium text-gray-300 mb-1">
        {feature.title} {feature.required && <span className="text-red-500">*</span>}
      </label>
      <div className="flex gap-2">
        <input
          {...register(fieldName)}
          type="number"
          placeholder={feature.title}
          className="flex-1 bg-input border border-gray-700 rounded h-10 px-3 text-sm focus:outline-none"
        />
        {feature.units && feature.units.length > 0 && (
          <select
            {...register(unitFieldName)}
            className="w-20 bg-input border border-gray-700 rounded h-10 px-2 text-sm focus:outline-none"
          >
            {feature.units.map((unit) => (
              <option key={unit} value={unit}>
                {unit.toUpperCase()}
              </option>
            ))}
          </select>
        )}
      </div>
    </div>
  );
};

// Textarea (textarea_text)
const TextareaField: FC<{
  feature: Feature;
  register: any;
}> = ({ feature, register }) => {
  const fieldName = `feature_${feature.id}`;
  
  return (
    <div>
      <label className="block text-xs font-medium text-gray-300 mb-1">
        {feature.title} {feature.required && <span className="text-red-500">*</span>}
      </label>
      <textarea
        {...register(fieldName)}
        placeholder={feature.title}
        rows={4}
        className="w-full bg-input border border-gray-700 rounded p-3 text-sm focus:outline-none resize-none"
      />
    </div>
  );
};

// Универсальный рендер поля по типу
const FeatureField: FC<{
  feature: Feature;
  register: any;
}> = ({ feature, register }) => {
  switch (feature.type) {
    case 'drop_down_options':
      return <DropdownField feature={feature} register={register} />;
    case 'textbox_text':
      return <TextboxField feature={feature} register={register} />;
    case 'textbox_numeric':
      return <NumericField feature={feature} register={register} />;
    case 'textbox_numeric_measurement':
      return <NumericMeasurementField feature={feature} register={register} />;
    case 'textarea_text':
      return <TextareaField feature={feature} register={register} />;
    default:
      return <TextboxField feature={feature} register={register} />;
  }
};

// ==========================================
// 3. КОМПОНЕНТ НАСТРОЕК (ФОРМА СЛЕВА)
// ==========================================
const NineNineNineSettings: FC = () => {
  const { register, setValue, watch } = useSettings();
  const { value: posts } = useIntegration();
  const [featuresGroups, setFeaturesGroups] = useState<FeatureGroup[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isParsed, setIsParsed] = useState(false);

  // Получаем текст из всех постов пользователя
  const getPostsText = useCallback(() => {
    const allPosts = posts || [];
    return allPosts
      .map((post: any) => post?.content || '')
      .filter(Boolean)
      .join('\n\n');
  }, [posts]);

  // Синхронизируем локальное состояние с глобальным
  useEffect(() => {
    globalParseState.isParsed = isParsed;
    globalParseState.featuresGroups = featuresGroups;
    if (isParsed) {
      globalParseState.lastParsedText = getPostsText();
    }
  }, [isParsed, featuresGroups, getPostsText]);

  // Восстанавливаем состояние из глобального при монтировании
  useEffect(() => {
    if (globalParseState.isParsed && globalParseState.featuresGroups.length > 0) {
      setFeaturesGroups(globalParseState.featuresGroups);
      setIsParsed(true);
    }
  }, []);

  // Загрузка конфигурации полей из Python API
  const loadPostConfig = useCallback(async (text?: string) => {
    const textToSend = text ?? getPostsText();
    
    if (!textToSend.trim()) {
      setError('Введите текст объявления в редакторе справа');
      return;
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
      console.log('[Frontend] Fetching post-config from Python API...');
      console.log('[Frontend] Text to parse:', textToSend.substring(0, 100) + '...');
      
      const data = await parseTextWithAI(textToSend);
      console.log('[Frontend] Received post-config:', data);
      
      setFeaturesGroups(data.features_groups || []);
      setIsParsed(true);
      
      // Обновляем глобальное состояние
      globalParseState.featuresGroups = data.features_groups || [];
      globalParseState.isParsed = true;
      globalParseState.lastParsedText = textToSend;
      
      // Устанавливаем значения из AI парсинга в форму
      data.features_groups?.forEach((group) => {
        group.features.forEach((feature) => {
          const fieldName = `feature_${feature.id}`;
          
          // Для dropdown устанавливаем label_id, для остальных — label
          if (feature.type === 'drop_down_options' && feature.label_id) {
            setValue(fieldName, feature.label_id);
          } else if (feature.label) {
            setValue(fieldName, feature.label);
          }
        });
      });
      
    } catch (err) {
      console.error('[Frontend] Error loading post-config:', err);
      setError('Не удалось загрузить конфигурацию. Python сервис недоступен.');
    } finally {
      setIsLoading(false);
    }
  }, [setValue, getPostsText]);

  useEffect(() => {
    // Устанавливаем дефолты для статических полей
    if (!watch('currency')) setValue('currency', 'eur');
    if (!watch('regionId')) setValue('regionId', '19');
  }, []);

  // Рендер группы полей
  const renderFeatureGroup = (group: FeatureGroup, index: number) => {
    const gridClass = group.features.length === 1 
      ? 'grid-cols-1' 
      : 'grid-cols-1 md:grid-cols-2';

    return (
      <div
        key={index}
        className="bg-gray-900/40 p-4 rounded border border-gray-700 flex flex-col gap-4"
      >
        <div className="text-sm font-bold text-blue-400 uppercase tracking-wide border-b border-gray-700 pb-1">
          {group.title}
        </div>
        
        <div className={`grid ${gridClass} gap-3`}>
          {group.features.map((feature) => (
            <FeatureField
              key={feature.id}
              feature={feature}
              register={register}
            />
          ))}
        </div>
      </div>
    );
  };

  // Текст из постов для отображения
  const currentText = getPostsText();

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-white">
        <div className="animate-spin w-8 h-8 border-2 border-blue-400 border-t-transparent rounded-full mb-4" />
        <p className="text-gray-400">Загрузка конфигурации...</p>
        <p className="text-xs text-gray-500 mt-2">AI парсит текст объявления</p>
      </div>
    );
  }

  // Если ещё не парсили — показываем кнопку запуска
  if (!isParsed && featuresGroups.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-white gap-4">
        <div className="text-5xl mb-2">🤖</div>
        <h3 className="text-lg font-semibold">AI Парсер объявлений</h3>
        <p className="text-sm text-gray-400 text-center max-w-md">
          Введите текст объявления в редакторе справа, затем нажмите кнопку ниже для автоматического заполнения полей
        </p>
        
        {currentText ? (
          <div className="w-full bg-gray-800/50 rounded p-3 max-h-32 overflow-y-auto">
            <p className="text-xs text-gray-500 mb-1">Текст для парсинга:</p>
            <p className="text-sm text-gray-300 whitespace-pre-wrap line-clamp-4">
              {currentText}
            </p>
          </div>
        ) : (
          <div className="w-full bg-yellow-900/30 border border-yellow-700/50 rounded p-3">
            <p className="text-sm text-yellow-400 text-center">
              ⚠️ Сначала введите текст объявления справа
            </p>
          </div>
        )}
        
        <button
          onClick={() => loadPostConfig()}
          disabled={!currentText}
          className={`px-6 py-3 rounded-lg font-medium transition flex items-center gap-2 ${
            currentText 
              ? 'bg-blue-600 hover:bg-blue-700 text-white' 
              : 'bg-gray-700 text-gray-500 cursor-not-allowed'
          }`}
        >
          🚀 Запустить AI парсинг
        </button>
        
        {error && (
          <p className="text-red-400 text-sm">{error}</p>
        )}
      </div>
    );
  }

  if (error && featuresGroups.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-white">
        <div className="text-red-400 text-4xl mb-4">⚠️</div>
        <p className="text-red-400">{error}</p>
        <button
          onClick={() => loadPostConfig()}
          className="mt-4 px-4 py-2 bg-blue-600 rounded hover:bg-blue-700 transition"
        >
          Повторить
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5 text-white pb-10">
      {/* Динамические группы из API */}
      {featuresGroups.map((group, index) => renderFeatureGroup(group, index))}

      {/* === БЛОК: РЕГИОН И ЛОКАЦИЯ (статический) === */}
      <div className="bg-gray-900/40 p-4 rounded border border-gray-700 flex flex-col gap-4">
        <div className="text-sm font-bold text-blue-400 uppercase tracking-wide border-b border-gray-700 pb-1">
          Локация
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-300 mb-1">
            Регион <span className="text-red-500">*</span>
          </label>
          <select
            {...register('regionId')}
            className="w-full bg-input border border-gray-700 rounded h-10 px-2 text-sm focus:outline-none"
          >
            {REGIONS.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            {...register('negotiable')}
            id="negotiable"
            className="w-4 h-4 rounded bg-input border-gray-700"
          />
          <label
            htmlFor="negotiable"
            className="text-sm text-gray-300 select-none cursor-pointer"
          >
            Разрешить торг
          </label>
        </div>
      </div>

      {/* Кнопка перезагрузки AI */}
      <button
        onClick={() => loadPostConfig()}
        type="button"
        disabled={!currentText}
        className={`w-full py-2 px-4 rounded text-sm transition flex items-center justify-center gap-2 ${
          currentText
            ? 'bg-gray-700 hover:bg-gray-600 text-gray-300'
            : 'bg-gray-800 text-gray-500 cursor-not-allowed'
        }`}
      >
        🔄 Перезапустить AI парсинг
      </button>
    </div>
  );
};


// ==========================================
// 4. КОМПОНЕНТ ПРЕВЬЮ (CustomPreviewComponent)
// ==========================================
const NineNineNinePreview: FC<{ maximumCharacters?: number }> = () => {
  const { watch } = useSettings();
  const { value: posts } = useIntegration();
  const [featuresGroups, setFeaturesGroups] = useState<FeatureGroup[]>([]);

  // Загружаем структуру полей для получения options и labels
  useEffect(() => {
    fetch('http://localhost:8000/api/post-config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: '' }), // Пустой текст — только структура
    })
      .then((res) => res.json())
      .then((data) => setFeaturesGroups(data.features_groups || []))
      .catch(() => {});
  }, []);

  // Получаем значения из динамических полей
  const getFeatureValue = (featureId: string) => {
    return watch(`feature_${featureId}`) || '';
  };

  // Находим feature по ID
  const findFeature = (featureId: string): Feature | undefined => {
    for (const group of featuresGroups) {
      const feature = group.features.find((f) => f.id === featureId);
      if (feature) return feature;
    }
    return undefined;
  };

  // Получаем label из options по ID
  const getOptionLabel = (featureId: string) => {
    const valueId = getFeatureValue(featureId);
    if (!valueId) return '';
    
    const feature = findFeature(featureId);
    if (!feature?.options) return valueId;
    
    const option = feature.options.find((opt) => opt.id === valueId);
    return option?.title || valueId;
  };

  // Основные данные
  const title = getFeatureValue('12');
  const price = getFeatureValue('2');
  const currency = watch('currency') || 'EUR';
  const regionName = REGIONS.find((r) => r.id === watch('regionId'))?.name || 'Молдова';
  const negotiable = watch('negotiable');

  // Авто данные для заголовка
  const year = getFeatureValue('19');
  const makeName = getOptionLabel('20');
  const modelName = getOptionLabel('21');
  const displayTitle = title || `${makeName} ${modelName} ${year}`.trim() || 'Новое объявление';

  // Описание берём ТОЛЬКО из настроек (feature_13)
  const description = getFeatureValue('13');

  // Контент из постов
  const allPosts = posts || [];

  // Собираем все характеристики для отображения
  const specsConfig = [
    { id: '19', label: 'Год', unit: '' },
    { id: '104', label: 'Пробег', unit: 'км' },
    { id: '2512', label: 'VIN', unit: '' },
    { id: '2553', label: 'Двигатель', isDropdown: true },
    { id: '107', label: 'Мощность', unit: 'л.с.' },
    { id: '151', label: 'Топливо', isDropdown: true },
    { id: '101', label: 'КПП', isDropdown: true },
    { id: '108', label: 'Привод', isDropdown: true },
    { id: '102', label: 'Кузов', isDropdown: true },
    { id: '17', label: 'Цвет', isDropdown: true },
    { id: '846', label: 'Мест', isDropdown: true },
    { id: '851', label: 'Дверей', isDropdown: true },
    { id: '593', label: 'Состояние', isDropdown: true },
    { id: '1761', label: 'Наличие', isDropdown: true },
    { id: '775', label: 'Регистрация', isDropdown: true },
    { id: '1763', label: 'Происхождение', isDropdown: true },
    { id: '2513', label: 'Запас хода', unit: 'км' },
    { id: '2554', label: 'Батарея', unit: 'kWh' },
    { id: '2555', label: 'Быстрая зарядка', unit: 'мин' },
  ];

  const specs = specsConfig
    .map((spec) => {
      let value = spec.isDropdown ? getOptionLabel(spec.id) : getFeatureValue(spec.id);
      
      if (!value) return null;
      
      // Добавляем единицы измерения
      if (spec.unit && value) {
        value = `${value} ${spec.unit}`;
      }
      
      return { label: spec.label, value };
    })
    .filter(Boolean) as { label: string; value: string }[];

  return (
    <div className="flex flex-col gap-4">
      {(allPosts.length > 0 ? allPosts : [{ content: '', image: [] }]).map((post: any, postIndex: number) => {
        const postImages = post?.image || [];
        const postActiveImage = postImages[0]?.path;

        return (
          <div key={postIndex} className="w-full bg-white rounded-lg overflow-hidden shadow-md text-black">
            {/* Галерея */}
            <div className="relative aspect-[16/10] bg-gray-100">
              {postActiveImage ? (
                <img 
                  src={postActiveImage} 
                  alt={displayTitle}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center text-gray-400">
                  <svg className="w-16 h-16 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <span className="text-sm">Нет изображений</span>
                </div>
              )}
              
              {postImages.length > 1 && (
                <div className="absolute bottom-2 right-2 bg-black/60 text-white text-xs px-2 py-1 rounded">
                  📷 {postImages.length}
                </div>
              )}
              
              {negotiable && (
                <div className="absolute top-2 left-2 bg-green-500 text-white text-xs px-2 py-1 rounded font-medium">
                  Торг
                </div>
              )}

              {allPosts.length > 1 && (
                <div className="absolute top-2 right-2 bg-blue-500 text-white text-xs px-2 py-1 rounded font-medium">
                  #{postIndex + 1}
                </div>
              )}
            </div>

            {/* Миниатюры */}
            {postImages.length > 1 && (
              <div className="flex gap-1 p-2 bg-gray-50 overflow-x-auto">
                {postImages.slice(0, 6).map((img: any, idx: number) => (
                  <div
                    key={idx}
                    className="w-14 h-10 flex-shrink-0 rounded overflow-hidden border border-gray-200"
                  >
                    <img src={img.path} className="w-full h-full object-cover" alt="" />
                  </div>
                ))}
                {postImages.length > 6 && (
                  <div className="w-14 h-10 flex-shrink-0 bg-gray-200 rounded flex items-center justify-center text-xs text-gray-500">
                    +{postImages.length - 6}
                  </div>
                )}
              </div>
            )}

            {/* Контент */}
            <div className="p-4">
              {/* Заголовок и цена */}
              <div className="flex justify-between items-start gap-3 mb-3">
                <h3 className="text-lg font-semibold text-gray-900 leading-tight flex-1">
                  {displayTitle}
                </h3>
                <div className="text-right flex-shrink-0">
                  <div className="text-xl font-bold text-blue-600">
                    {price || '—'} <span className="text-sm font-normal text-gray-500">{currency.toUpperCase()}</span>
                  </div>
                </div>
              </div>

              {/* Характеристики */}
              {specs.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-3">
                  {specs.map((spec, i) => (
                    <span 
                      key={i} 
                      className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 rounded text-xs text-gray-600"
                    >
                      <span className="font-medium">{spec.label}:</span>
                      <span>{spec.value}</span>
                    </span>
                  ))}
                </div>
              )}

              {/* Описание */}
              <p className="text-sm text-gray-600 line-clamp-3 mb-3">
                {description || 'Описание объявления...'}
              </p>

              {/* Футер */}
              <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                <div className="flex items-center gap-1 text-xs text-gray-500">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <span>{regionName}</span>
                </div>
                <div className="text-xs text-gray-400">
                  999.md
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default withProvider({
  postComment: PostComment.COMMENT,
  minimumCharacters: [],
  SettingsComponent: NineNineNineSettings,
  CustomPreviewComponent: NineNineNinePreview,
  dto: undefined,
  checkValidity: checkNineNineNineValidity,
  maximumCharacters: 5000,
});