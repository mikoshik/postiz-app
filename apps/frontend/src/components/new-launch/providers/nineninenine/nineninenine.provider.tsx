'use client';

import React, { FC, useEffect, useState } from 'react';
import {
  PostComment,
  withProvider,
} from '@gitroom/frontend/components/new-launch/providers/high.order.provider';
import { useSettings } from '@gitroom/frontend/components/launches/helpers/use.values';
import { useIntegration } from '@gitroom/frontend/components/launches/helpers/use.integration';
import { Input } from '@gitroom/react/form/input';

// --- ЗАГЛУШКИ ДАННЫХ (MOCK DATA) ---
// В будущем эти массивы мы будем заменять на данные, пришедшие с API 999
const SUB_CATEGORIES = [
    { id: '659', name: 'Легковые автомобили' },
    { id: '660', name: 'Автобусы и микроавтобусы' },
    { id: '661', name: 'Мотоциклы и мототехника' },
    { id: '658', name: 'Грузовые автомобили' },
];

const OFFER_TYPES = [
    { id: '776', name: 'Продам' },
    { id: '777', name: 'Куплю' },
    { id: '790', name: 'Авто на заказ' },
    { id: '778', name: 'Меняю' },
];

// Пример того, что вернет API на запрос "Get Makes" (Марки)
const MOCK_MAKES = [
    { id: '124', name: 'BMW' },
    { id: '125', name: 'Mercedes-Benz' },
    { id: '126', name: 'Toyota' },
    { id: '127', name: 'Ford' },
    { id: '128', name: 'Volkswagen' },
    { id: '129', name: 'Honda' },
];

// Пример моделей (зависит от марки)
const MOCK_MODELS = [
    { id: '555', name: 'X5' },
    { id: '556', name: '5 Series' },
    { id: '557', name: '3 Series' },
];

const REGISTRATION_TYPES = [
    { id: '1', name: 'Республика Молдова' },
    { id: '2', name: 'Приднестровье' },
    { id: '3', name: 'Иностранная' },
    { id: '4', name: 'Нет' },
];

const FUEL_TYPES = [
    { id: '12', name: 'Бензин' },
    { id: '13', name: 'Дизель' },
    { id: '14', name: 'Гибрид' },
    { id: '15', name: 'Электро' },
    { id: '16', name: 'Газ / Бензин' },
];

const GEARBOX_TYPES = [
    { id: '20', name: 'Автомат' },
    { id: '21', name: 'Механика' },
    { id: '22', name: 'Робот' },
    { id: '23', name: 'Вариатор' },
];

const BODY_TYPES = [
    { id: '30', name: 'Седан' },
    { id: '31', name: 'Универсал' },
    { id: '32', name: 'Хэтчбек' },
    { id: '33', name: 'Кроссовер' },
    { id: '34', name: 'Минивэн' },
];

const DRIVETRAIN_TYPES = [
    { id: '40', name: 'Передний' },
    { id: '41', name: 'Задний' },
    { id: '42', name: 'Полный' },
];

// --- 1. ПАНЕЛЬ НАСТРОЕК (ФОРМА) ---
const NineNineNineSettings: FC = () => {
  const { register, setValue, watch } = useSettings();
  
  // -- ЛОГИКА ДИНАМИЧЕСКИХ СПИСКОВ (ЗАГЛУШКА) --
  // Здесь мы в будущем будем делать fetch к API, когда меняется categoryId или car_brand
  // const { data: makes } = useFetch('/api/999/makes'); 
  
  useEffect(() => {
    // Дефолтные значения при загрузке
    if (!watch('categoryId')) setValue('categoryId', '658'); // Всегда Транспорт
    if (!watch('subcategoryId')) setValue('subcategoryId', '659'); // Легковые
    if (!watch('offerType')) setValue('offerType', '776'); // Продам
    if (!watch('currency')) setValue('currency', 'eur');
    if (!watch('regionId')) setValue('regionId', '12'); // Кишинев
  }, []);

  return (
    <div className="flex flex-col gap-5 text-white pb-10">
       
       {/* === БЛОК 1: ЧТО ПОДАЕМ === */}
       <div className="bg-gray-900/40 p-4 rounded border border-gray-700 flex flex-col gap-4">
           <div className="text-sm font-bold text-blue-400 uppercase tracking-wide border-b border-gray-700 pb-1">
               1. Раздел и Тип
           </div>
           
           <div className="grid grid-cols-1 gap-3">
               {/* Раздел (Readonly) */}
               <div>
                   <label className="block text-xs font-medium text-gray-500 mb-1">Раздел</label>
                   <input 
                     value="Транспорт (658)" 
                     disabled 
                     className="w-full bg-gray-800 border border-gray-700 rounded h-10 px-3 text-sm text-gray-400 cursor-not-allowed"
                   />
                   <input type="hidden" {...register('categoryId')} />
               </div>

               {/* Подкатегория (Dropdown) */}
               <div>
                   <label className="block text-xs font-medium text-gray-300 mb-1">Подкатегория</label>
                   <select {...register('subcategoryId')} className="w-full bg-input border border-gray-700 rounded h-10 px-2 text-sm focus:outline-none">
                       {SUB_CATEGORIES.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
                   </select>
               </div>

               {/* Тип предложения (Dropdown) */}
               <div>
                   <label className="block text-xs font-medium text-gray-300 mb-1">Тип предложения <span className="text-red-500">*</span></label>
                   <select {...register('offerType')} className="w-full bg-input border border-gray-700 rounded h-10 px-2 text-sm focus:outline-none">
                       {OFFER_TYPES.map(type => <option key={type.id} value={type.id}>{type.name}</option>)}
                   </select>
               </div>
           </div>
       </div>

       {/* === БЛОК 2: ИДЕНТИФИКАЦИЯ АВТО === */}
       <div className="bg-gray-900/40 p-4 rounded border border-gray-700 flex flex-col gap-4">
           <div className="text-sm font-bold text-blue-400 uppercase tracking-wide border-b border-gray-700 pb-1">
               2. Автомобиль
           </div>

           <div className="grid grid-cols-2 gap-3">
               {/* Марка (Dynamic Dropdown) */}
               <div>
                   <label className="block text-xs font-medium text-gray-300 mb-1">Марка <span className="text-red-500">*</span></label>
                   <select {...register('car_brand')} className="w-full bg-input border border-gray-700 rounded h-10 px-2 text-sm focus:outline-none">
                       <option value="">Выберите...</option>
                       {MOCK_MAKES.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                   </select>
               </div>

               {/* Модель (Dependent Dropdown) */}
               <div>
                   <label className="block text-xs font-medium text-gray-300 mb-1">Модель <span className="text-red-500">*</span></label>
                   <select {...register('car_model')} className="w-full bg-input border border-gray-700 rounded h-10 px-2 text-sm focus:outline-none">
                       <option value="">Выберите...</option>
                       {MOCK_MODELS.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                   </select>
               </div>
           </div>

           {/* Регистрация и Состояние */}
           <div className="grid grid-cols-2 gap-3">
               <div>
                   <label className="block text-xs font-medium text-gray-300 mb-1">Регистрация</label>
                   <select {...register('car_registration')} className="w-full bg-input border border-gray-700 rounded h-10 px-2 text-sm focus:outline-none">
                       {REGISTRATION_TYPES.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                   </select>
               </div>
               <div>
                   <label className="block text-xs font-medium text-gray-300 mb-1">Состояние</label>
                   <select {...register('car_condition')} className="w-full bg-input border border-gray-700 rounded h-10 px-2 text-sm focus:outline-none">
                       <option value="1">Не битый</option>
                       <option value="2">Битый / Аварийный</option>
                       <option value="3">На запчасти</option>
                   </select>
               </div>
           </div>

           <Input label="VIN-код" placeholder="WBA..." {...register('car_vin')} />
       </div>

       {/* === БЛОК 3: ТЕХНИЧЕСКИЕ ХАРАКТЕРИСТИКИ === */}
       <div className="bg-gray-900/40 p-4 rounded border border-gray-700 flex flex-col gap-4">
           <div className="text-sm font-bold text-blue-400 uppercase tracking-wide border-b border-gray-700 pb-1">
               3. Свойства (Features)
           </div>

           <div className="grid grid-cols-2 gap-3">
               <Input label="Год выпуска *" type="number" placeholder="2018" {...register('car_year')} />
               <Input label="Пробег (КМ) *" type="number" placeholder="150000" {...register('car_mileage')} />
           </div>

           <div className="grid grid-cols-2 gap-3">
               <div>
                   <label className="block text-xs font-medium text-gray-300 mb-1">Тип кузова</label>
                   <select {...register('car_body')} className="w-full bg-input border border-gray-700 rounded h-10 px-2 text-sm focus:outline-none">
                       {BODY_TYPES.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                   </select>
               </div>
               <div>
                   <label className="block text-xs font-medium text-gray-300 mb-1">Руль</label>
                   <select {...register('car_steering')} className="w-full bg-input border border-gray-700 rounded h-10 px-2 text-sm focus:outline-none">
                       <option value="left">Слева</option>
                       <option value="right">Справа</option>
                   </select>
               </div>
           </div>

           <div className="grid grid-cols-2 gap-3">
               <div>
                   <label className="block text-xs font-medium text-gray-300 mb-1">Тип топлива *</label>
                   <select {...register('car_fuel')} className="w-full bg-input border border-gray-700 rounded h-10 px-2 text-sm focus:outline-none">
                       {FUEL_TYPES.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                   </select>
               </div>
               <div>
                   <label className="block text-xs font-medium text-gray-300 mb-1">КПП *</label>
                   <select {...register('car_gearbox')} className="w-full bg-input border border-gray-700 rounded h-10 px-2 text-sm focus:outline-none">
                       {GEARBOX_TYPES.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                   </select>
               </div>
           </div>

           <div className="grid grid-cols-2 gap-3">
               <Input label="Объем двигателя (см3)" type="number" placeholder="2000" {...register('car_engine_vol')} />
               <Input label="Мощность (л.с.)" type="number" placeholder="190" {...register('car_power')} />
           </div>

           <div>
                <label className="block text-xs font-medium text-gray-300 mb-1">Привод</label>
                <select {...register('car_drive')} className="w-full bg-input border border-gray-700 rounded h-10 px-2 text-sm focus:outline-none">
                    {DRIVETRAIN_TYPES.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
           </div>
       </div>

       {/* === БЛОК 4: ФИНАНСЫ И ЛОКАЦИЯ === */}
       <div className="bg-gray-900/40 p-4 rounded border border-gray-700 flex flex-col gap-4">
           <div className="text-sm font-bold text-blue-400 uppercase tracking-wide border-b border-gray-700 pb-1">
               4. Финансы и Локация
           </div>

           {/* Регион */}
           <Input label="Регион ID (Пока ручной ввод)" placeholder="12 (Кишинев)" {...register('regionId')} />

           {/* Цена */}
           <div className="flex gap-2">
             <div className="flex-1">
                 <Input label="Цена *" type="number" placeholder="0" {...register('price')} />
             </div>
             <div className="w-24">
                 <label className="block text-xs font-medium text-gray-400 mb-1">Валюта</label>
                 <select {...register('currency')} className="w-full bg-input border border-gray-700 rounded h-10 px-2 text-sm focus:outline-none">
                    <option value="eur">EUR</option>
                    <option value="usd">USD</option>
                    <option value="mdl">MDL</option>
                 </select>
             </div>
           </div>
           
           <div className="flex items-center gap-2">
               <input type="checkbox" {...register('negotiable')} id="negotiable" className="w-4 h-4 rounded bg-input border-gray-700" />
               <label htmlFor="negotiable" className="text-sm text-gray-300 select-none">Разрешить торг</label>
           </div>
       </div>

    </div>
  );
};

// --- 2. ПРЕВЬЮ ---
const NineNineNinePreview: FC = () => {
  const settings = useSettings(); 
  const { value } = useIntegration();
  
  // Получаем данные для отображения
  const title = settings.watch('title') || 'Без заголовка...'; // Заголовок (генерируется AI или вручную)
  const price = settings.watch('price') || 'Договорная';
  const currency = settings.watch('currency') || 'EUR';
  const offerType = settings.watch('offerType');
  const region = settings.watch('regionId') === '12' ? 'Кишинев' : 'Молдова';
  
  // Находим названия по ID для красивого отображения
  const brandId = settings.watch('car_brand');
  const brandName = MOCK_MAKES.find(m => m.id === brandId)?.name || '';
  const modelId = settings.watch('car_model');
  const modelName = MOCK_MODELS.find(m => m.id === modelId)?.name || '';
  const year = settings.watch('car_year');
  
  // Автоматический заголовок для превью, если пользователь не ввел свой
  const displayTitle = title !== 'Без заголовка...' ? title : `${brandName} ${modelName} ${year}`.trim() || 'Новое объявление';

  const offerLabel = offerType === '777' ? 'Куплю' : 'Продам';
  const offerColor = offerType === '777' ? 'text-green-600' : 'text-gray-500';

  const description = value?.[0]?.content || '';
  const firstImage = value?.[0]?.image?.[0]?.path;
  const imageCount = value?.[0]?.image?.length || 0;

  return (
    <div className="w-full bg-white rounded-md overflow-hidden border border-gray-300 font-sans text-left shadow-sm select-none text-black">
      <div className="bg-[#ff6600] h-1 w-full"></div>
      
      <div className="p-3 flex gap-3">
        <div className="w-28 h-20 bg-gray-100 flex-shrink-0 rounded object-cover overflow-hidden flex items-center justify-center border border-gray-200 relative">
            {firstImage ? (
                <img src={firstImage} alt="Preview" className="w-full h-full object-cover" />
            ) : (
                <span className="text-gray-400 text-[10px]">Фото</span>
            )}
            {imageCount > 1 && (
                <div className="absolute bottom-1 right-1 bg-black/70 text-white text-[10px] px-1.5 rounded font-medium">
                    +{imageCount}
                </div>
            )}
        </div>

        <div className="flex flex-col justify-between w-full min-w-0 h-24">
            <div>
                <div className="text-[#0079c2] font-medium text-sm leading-tight truncate mb-1 cursor-pointer hover:underline">
                    {displayTitle}
                </div>
                
                <div className="text-gray-500 text-[11px] line-clamp-2 leading-3 h-8">
                    {description || 'Описание...'}
                </div>
            </div>
            
            <div className="flex justify-between items-end border-t border-gray-100 pt-1">
                <div className="font-bold text-black text-base">
                    {price} <span className="text-xs font-normal text-gray-500 uppercase">{currency}</span>
                </div>
                <div className="flex flex-col items-end">
                    <span className={`text-[10px] ${offerColor} font-medium`}>{offerLabel}</span>
                    <span className="text-[10px] text-gray-400">{region}</span>
                </div>
            </div>
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