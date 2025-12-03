'use client';

import React, { FC, useEffect, useState, useCallback } from 'react';
import {
  PostComment,
  withProvider,
} from '@gitroom/frontend/components/new-launch/providers/high.order.provider';
import { useSettings } from '@gitroom/frontend/components/launches/helpers/use.values';
import { useIntegration } from '@gitroom/frontend/components/launches/helpers/use.integration';
import { Input } from '@gitroom/react/form/input';

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

// Заглушка текста для AI парсинга (потом подключим реальный)
const STUB_TEXT = `
Продаю Volkswagen Passat B8 2019 года выпуска.
VIN: WVWZZZ3CZWE123456
Пробег 85000 км, двигатель 2.0 TDI, 150 л.с.
Коробка автомат DSG, передний привод.
Цвет серый металлик, седан, 4 двери, 5 мест.
Цена 15500 евро, возможен торг.
Состояние отличное, один владелец.
`;

// ==========================================
// 2. КОМПОНЕНТЫ ДЛЯ РАЗНЫХ ТИПОВ ПОЛЕЙ
// ==========================================

// Dropdown (drop_down_options)
const DropdownField: FC<{
  feature: Feature;
  register: any;
  value?: string;
  onChange?: (value: string) => void;
}> = ({ feature, register, value, onChange }) => {
  const fieldName = `feature_${feature.id}`;
  
  return (
    <div>
      <label className="block text-xs font-medium text-gray-300 mb-1">
        {feature.title} {feature.required && <span className="text-red-500">*</span>}
      </label>
      <select
        {...register(fieldName)}
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
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
  watch: any;
  setValue: any;
}> = ({ feature, register, watch, setValue }) => {
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
  const [featuresGroups, setFeaturesGroups] = useState<FeatureGroup[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Загрузка конфигурации полей из Python API
  const loadPostConfig = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      console.log('[Frontend] Fetching post-config from Python API...');
      
      const response = await fetch('http://localhost:8000/api/post-config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text: STUB_TEXT }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data: PostConfigResponse = await response.json();
      console.log('[Frontend] Received post-config:', data);
      
      setFeaturesGroups(data.features_groups || []);
      
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
  }, [setValue]);

  useEffect(() => {
    loadPostConfig();
    
    // Устанавливаем дефолты для статических полей
    if (!watch('currency')) setValue('currency', 'eur');
    if (!watch('regionId')) setValue('regionId', '12');
  }, []);

  // Рендер группы полей
  const renderFeatureGroup = (group: FeatureGroup, index: number) => {
    // Определяем сетку в зависимости от количества полей
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
              watch={watch}
              setValue={setValue}
            />
          ))}
        </div>
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-white">
        <div className="animate-spin w-8 h-8 border-2 border-blue-400 border-t-transparent rounded-full mb-4" />
        <p className="text-gray-400">Загрузка конфигурации...</p>
        <p className="text-xs text-gray-500 mt-2">AI парсит текст объявления</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-white">
        <div className="text-red-400 text-4xl mb-4">⚠️</div>
        <p className="text-red-400">{error}</p>
        <button
          onClick={loadPostConfig}
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
        onClick={loadPostConfig}
        type="button"
        className="w-full py-2 px-4 bg-gray-700 hover:bg-gray-600 rounded text-sm text-gray-300 transition flex items-center justify-center gap-2"
      >
        🔄 Перезапустить AI парсинг
      </button>
    </div>
  );
};


// ==========================================
// 4. КОМПОНЕНТ ПРЕВЬЮ (БОЛЬШАЯ КАРТОЧКА СПРАВА)
// ==========================================
const NineNineNinePreview: FC = () => {
  const settings = useSettings();
  const { value } = useIntegration();

  // Получаем значения из динамических полей
  const getFeatureValue = (featureId: string) => {
    return settings.watch(`feature_${featureId}`) || '';
  };

  // Основные данные
  const title = getFeatureValue('12'); // Заголовок объявления
  const price = getFeatureValue('2'); // Цена
  const currency = settings.watch('currency') || 'EUR';
  const regionName = REGIONS.find((r) => r.id === settings.watch('regionId'))?.name || 'Молдова';
  const negotiable = settings.watch('negotiable');

  // Авто данные
  const year = getFeatureValue('19'); // Год выпуска
  const displayTitle = title || `Автомобиль ${year}`.trim() || 'Новое объявление';

  // Контент
  const rawContent = value?.[0]?.content || '';
  const description = getFeatureValue('13') || rawContent.replace(/<[^>]+>/g, '\n');
  const images = value?.[0]?.image || [];

  // Переключение картинок
  const [activeImgIndex, setActiveImgIndex] = useState(0);
  const activeImage = images[activeImgIndex]?.path;

  // Сборка характеристик для отображения
  const specs = [
    { label: 'Год выпуска', value: getFeatureValue('19') },
    { label: 'Пробег', value: getFeatureValue('104') ? `${getFeatureValue('104')} км` : '' },
    { label: 'VIN-код', value: getFeatureValue('2512') },
    { label: 'Мощность', value: getFeatureValue('107') ? `${getFeatureValue('107')} л.с.` : '' },
  ].filter((s) => s.value);

  return (
    <div className="w-full bg-white rounded-md overflow-hidden border border-gray-300 font-sans text-left shadow-lg select-none text-black">
      {/* Шапка объявления */}
      <div className="p-4 border-b border-gray-100 bg-gray-50">
        <h1 className="text-xl font-bold text-[#0079c2] mb-1 leading-snug">
          {displayTitle}
        </h1>
        <div className="flex justify-between items-end">
          <div className="text-2xl font-bold text-black flex items-baseline gap-2">
            {price || 'Договорная'}{' '}
            <span className="text-sm font-normal text-gray-500 uppercase">{currency}</span>
            {negotiable && (
              <span className="text-xs text-green-600 font-normal border border-green-200 px-1 rounded">
                Торг
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Галерея */}
      <div className="bg-gray-200 aspect-[4/3] relative flex items-center justify-center overflow-hidden">
        {activeImage ? (
          <img src={activeImage} alt="Main" className="w-full h-full object-contain bg-black" />
        ) : (
          <div className="flex flex-col items-center text-gray-400">
            <span className="text-4xl mb-2">📷</span>
            <span className="text-sm">Нет фото</span>
          </div>
        )}

        {images.length > 1 && (
          <div className="absolute bottom-3 right-3 bg-black/70 text-white text-xs px-2 py-1 rounded-full">
            📷 {activeImgIndex + 1} / {images.length}
          </div>
        )}
      </div>

      {/* Миниатюры */}
      {images.length > 1 && (
        <div className="flex gap-1 p-1 overflow-x-auto bg-gray-100">
          {images.map((img: any, idx: number) => (
            <div
              key={idx}
              onClick={() => setActiveImgIndex(idx)}
              className={`w-16 h-12 flex-shrink-0 cursor-pointer border-2 ${
                activeImgIndex === idx ? 'border-[#ff6600]' : 'border-transparent'
              }`}
            >
              <img src={img.path} className="w-full h-full object-cover" />
            </div>
          ))}
        </div>
      )}

      {/* Таблица характеристик */}
      {specs.length > 0 && (
        <div className="p-4 bg-white">
          <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            {specs.map((spec, i) => (
              <div key={i} className="flex justify-between border-b border-gray-100 pb-1">
                <span className="text-gray-500">{spec.label}</span>
                <span className="text-black font-medium text-right">{spec.value}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Описание */}
      <div className="p-4 pt-2">
        <h3 className="font-bold text-gray-800 mb-2 text-sm uppercase">Описание</h3>
        <div className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed break-words">
          {description || 'Добавьте описание товара в редакторе...'}
        </div>
      </div>

      {/* Футер */}
      <div className="p-4 bg-[#f2f9ff] border-t border-blue-100 mt-2 flex justify-between items-center">
        <div>
          <div className="text-xs text-gray-500">Регион</div>
          <div className="text-sm font-bold text-[#0079c2]">{regionName}</div>
        </div>
        <div className="text-[#0079c2] font-bold text-lg flex items-center gap-2">
          <span>📞 +373 79 000 000</span>
        </div>
      </div>
    </div>
  );
};

export default withProvider({
  postComment: PostComment.COMMENT,
  minimumCharacters: [],
  SettingsComponent: NineNineNineSettings,
  CustomPreviewComponent: NineNineNinePreview,
  dto: undefined,
  checkValidity: undefined,
  maximumCharacters: 5000,
});