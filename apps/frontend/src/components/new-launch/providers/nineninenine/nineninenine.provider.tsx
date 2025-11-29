'use client';

import React, { FC, useEffect, useState } from 'react';
import {
  PostComment,
  withProvider,
} from '@gitroom/frontend/components/new-launch/providers/high.order.provider';
import { useSettings } from '@gitroom/frontend/components/launches/helpers/use.values';
import { useIntegration } from '@gitroom/frontend/components/launches/helpers/use.integration';
import { Input } from '@gitroom/react/form/input';

// ==========================================
// 1. СПИСКИ ДАННЫХ (CONSTANTS)
// ==========================================

const REGIONS = [
    { id: '12', name: 'Кишинев' },
    { id: '16', name: 'Бельцы' },
    { id: '19', name: 'Комрат' },
    { id: '18', name: 'Кагул' },
    { id: '29', name: 'Оргеев' },
    { id: '35', name: 'Тирасполь' },
    { id: '14', name: 'Другой / Вся Молдова' },
];

const SUB_CATEGORIES = [
    { id: '659', name: 'Легковые автомобили' },
    { id: '660', name: 'Автобусы и микроавтобусы' },
    { id: '661', name: 'Мотоциклы и мототехника' },
];

const OFFER_TYPES = [
    { id: '776', name: 'Продам' },
    { id: '777', name: 'Куплю' },
    { id: '790', name: 'Авто на заказ' },
    { id: '778', name: 'Меняю' },
];

const MOCK_MAKES = [
    { id: '124', name: 'BMW' }, { id: '125', name: 'Mercedes-Benz' }, { id: '126', name: 'Toyota' },
    { id: '127', name: 'Ford' }, { id: '128', name: 'Volkswagen' }, { id: '129', name: 'Honda' },
];

const MOCK_MODELS = [
    { id: '555', name: 'X5' }, { id: '556', name: '5 Series' }, { id: '557', name: '3 Series' },
    { id: '558', name: 'E-Class' }, { id: '559', name: 'Passat' }, { id: '560', name: 'Camry' }
];

const REGISTRATION_TYPES = [
    { id: '1', name: 'Республика Молдова' },
    { id: '2', name: 'Приднестровье' },
    { id: '3', name: 'Иностранная' },
    { id: '4', name: 'Нет' },
];

const CONDITION_TYPES = [
    { id: '1', name: 'Не битый' },
    { id: '2', name: 'Битый / Аварийный' },
    { id: '3', name: 'На запчасти' },
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
];

const BODY_TYPES = [
    { id: '30', name: 'Седан' }, 
    { id: '31', name: 'Универсал' }, 
    { id: '32', name: 'Хэтчбек' },
    { id: '33', name: 'Кроссовер' }, 
    { id: '34', name: 'Минивэн' }, 
    { id: '35', name: 'Купе' },
];

const DRIVETRAIN_TYPES = [
    { id: '40', name: 'Передний' }, 
    { id: '41', name: 'Задний' }, 
    { id: '42', name: 'Полный' },
];

const COLOR_TYPES = [
    { id: '1', name: 'Черный' }, { id: '2', name: 'Белый' }, { id: '3', name: 'Серебристый' }, { id: '4', name: 'Серый' }, { id: '5', name: 'Красный' }, { id: '6', name: 'Синий' },
];

const STEERING_TYPES = [
    { id: 'left', name: 'Слева' }, { id: 'right', name: 'Справа' },
];

// Хелпер: найти имя по ID (безопасный поиск)
const getName = (list: any[], id: string) => {
    if (!id) return undefined;
    return list.find(item => item.id === id || item.id === String(id))?.name;
};


// ==========================================
// 2. КОМПОНЕНТ НАСТРОЕК (ФОРМА СЛЕВА)
// ==========================================
const NineNineNineSettings: FC = () => {
  const { register, setValue, watch } = useSettings();
  
  useEffect(() => {
    if (!watch('currency')) setValue('currency', 'eur');
    if (!watch('offerType')) setValue('offerType', '776');
    if (!watch('regionId')) setValue('regionId', '12');
    if (!watch('subcategoryId')) setValue('subcategoryId', '659');
  }, []);

  return (
    <div className="flex flex-col gap-5 text-white pb-10">
       
       {/* === БЛОК 1: ЧТО ПОДАЕМ === */}
       <div className="bg-gray-900/40 p-4 rounded border border-gray-700 flex flex-col gap-4">
           <div className="text-sm font-bold text-blue-400 uppercase tracking-wide border-b border-gray-700 pb-1">
               1. Раздел и Тип
           </div>
           
           <div className="grid grid-cols-1 gap-3">
               <div>
                   <label className="block text-xs font-medium text-gray-500 mb-1">Раздел</label>
                   <input value="Транспорт (658)" disabled className="w-full bg-gray-800 border border-gray-700 rounded h-10 px-3 text-sm text-gray-400 cursor-not-allowed" />
                   <input type="hidden" {...register('categoryId')} />
               </div>
               <div>
                   <label className="block text-xs font-medium text-gray-300 mb-1">Подкатегория</label>
                   <select {...register('subcategoryId')} className="w-full bg-input border border-gray-700 rounded h-10 px-2 text-sm focus:outline-none">
                       {SUB_CATEGORIES.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
                   </select>
               </div>
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

           <Input label="Заголовок" placeholder="BMW X5, 2018..." {...register('title')} />

           <div className="grid grid-cols-2 gap-3">
               <div>
                   <label className="block text-xs font-medium text-gray-300 mb-1">Марка <span className="text-red-500">*</span></label>
                   <select {...register('car_brand')} className="w-full bg-input border border-gray-700 rounded h-10 px-2 text-sm focus:outline-none">
                       <option value="">Выберите...</option>
                       {MOCK_MAKES.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                   </select>
               </div>
               <div>
                   <label className="block text-xs font-medium text-gray-300 mb-1">Модель <span className="text-red-500">*</span></label>
                   <select {...register('car_model')} className="w-full bg-input border border-gray-700 rounded h-10 px-2 text-sm focus:outline-none">
                       <option value="">Выберите...</option>
                       {MOCK_MODELS.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                   </select>
               </div>
           </div>

           <div className="grid grid-cols-2 gap-3">
               <div>
                   <label className="block text-xs font-medium text-gray-300 mb-1">Регистрация</label>
                   <select {...register('car_registration')} className="w-full bg-input border border-gray-700 rounded h-10 px-2 text-sm focus:outline-none">
                       <option value="">Не выбрано</option>
                       {REGISTRATION_TYPES.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                   </select>
               </div>
               <div>
                   <label className="block text-xs font-medium text-gray-300 mb-1">Состояние</label>
                   <select {...register('car_condition')} className="w-full bg-input border border-gray-700 rounded h-10 px-2 text-sm focus:outline-none">
                       <option value="">Не выбрано</option>
                       {CONDITION_TYPES.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
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
                       <option value="">Не выбрано</option>
                       {BODY_TYPES.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                   </select>
               </div>
               <div>
                   <label className="block text-xs font-medium text-gray-300 mb-1">Руль</label>
                   <select {...register('car_steering')} className="w-full bg-input border border-gray-700 rounded h-10 px-2 text-sm focus:outline-none">
                       <option value="">Не выбрано</option>
                       {STEERING_TYPES.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                   </select>
               </div>
           </div>

           <div className="grid grid-cols-2 gap-3">
               <div>
                   <label className="block text-xs font-medium text-gray-300 mb-1">Тип топлива *</label>
                   <select {...register('car_fuel')} className="w-full bg-input border border-gray-700 rounded h-10 px-2 text-sm focus:outline-none">
                       <option value="">Не выбрано</option>
                       {FUEL_TYPES.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                   </select>
               </div>
               <div>
                   <label className="block text-xs font-medium text-gray-300 mb-1">КПП *</label>
                   <select {...register('car_gearbox')} className="w-full bg-input border border-gray-700 rounded h-10 px-2 text-sm focus:outline-none">
                       <option value="">Не выбрано</option>
                       {GEARBOX_TYPES.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                   </select>
               </div>
           </div>

           <div className="grid grid-cols-2 gap-3">
               <Input label="Объем (см3)" type="number" placeholder="2000" {...register('car_engine_vol')} />
               <Input label="Мощность (л.с.)" type="number" placeholder="190" {...register('car_power')} />
           </div>

           <div className="grid grid-cols-2 gap-3">
               <div>
                    <label className="block text-xs font-medium text-gray-300 mb-1">Привод</label>
                    <select {...register('car_drive')} className="w-full bg-input border border-gray-700 rounded h-10 px-2 text-sm focus:outline-none">
                        <option value="">Не выбрано</option>
                        {DRIVETRAIN_TYPES.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                    </select>
               </div>
               <div>
                    <label className="block text-xs font-medium text-gray-300 mb-1">Цвет</label>
                    <select {...register('car_color')} className="w-full bg-input border border-gray-700 rounded h-10 px-2 text-sm focus:outline-none">
                        <option value="">Не выбрано</option>
                        {COLOR_TYPES.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
               </div>
           </div>

           <div className="grid grid-cols-2 gap-3">
               <Input label="Кол-во дверей" type="number" placeholder="5" {...register('car_doors')} />
               <Input label="Кол-во мест" type="number" placeholder="5" {...register('car_seats')} />
           </div>
       </div>

       {/* === БЛОК 4: ФИНАНСЫ И ЛОКАЦИЯ === */}
       <div className="bg-gray-900/40 p-4 rounded border border-gray-700 flex flex-col gap-4">
           <div className="text-sm font-bold text-blue-400 uppercase tracking-wide border-b border-gray-700 pb-1">
               4. Финансы и Локация
           </div>

           {/* Регион */}
           <div>
                <label className="block text-xs font-medium text-gray-300 mb-1">Регион</label>
                <select {...register('regionId')} className="w-full bg-input border border-gray-700 rounded h-10 px-2 text-sm focus:outline-none">
                    {REGIONS.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
           </div>

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
               <label htmlFor="negotiable" className="text-sm text-gray-300 select-none cursor-pointer">Разрешить торг</label>
           </div>
       </div>

    </div>
  );
};


// ==========================================
// 3. КОМПОНЕНТ ПРЕВЬЮ (БОЛЬШАЯ КАРТОЧКА СПРАВА)
// ==========================================
const NineNineNinePreview: FC = () => {
  const settings = useSettings(); 
  const { value } = useIntegration();
  
  // Данные
  const title = settings.watch('title');
  const price = settings.watch('price') || 'Договорная';
  const currency = settings.watch('currency') || 'EUR';
  const regionName = getName(REGIONS, settings.watch('regionId')) || 'Молдова';
  const negotiable = settings.watch('negotiable');
  
  // Авто-сборка заголовка
  const brandName = getName(MOCK_MAKES, settings.watch('car_brand')) || '';
  const modelName = getName(MOCK_MODELS, settings.watch('car_model')) || '';
  const year = settings.watch('car_year') || '';
  const displayTitle = title || `${brandName} ${modelName} ${year}`.trim() || 'Новое объявление';

  // Контент (очистка HTML)
  const rawContent = value?.[0]?.content || '';
  const description = rawContent.replace(/<[^>]+>/g, '\n'); 
  const images = value?.[0]?.image || [];
  const firstImage = images[0]?.path;

  // Переключение картинок
  const [activeImgIndex, setActiveImgIndex] = useState(0);
  const activeImage = images[activeImgIndex]?.path || firstImage;

  // --- СБОРКА ТАБЛИЦЫ ХАРАКТЕРИСТИК (ВСЕ ПОЛЯ) ---
  const specs = [
      { label: 'Марка', value: brandName },
      { label: 'Модель', value: modelName },
      { label: 'Год выпуска', value: year },
      { label: 'Регистрация', value: getName(REGISTRATION_TYPES, settings.watch('car_registration')) },
      { label: 'Состояние', value: getName(CONDITION_TYPES, settings.watch('car_condition')) },
      { label: 'VIN', value: settings.watch('car_vin') },
      
      { label: 'Пробег', value: settings.watch('car_mileage') ? `${settings.watch('car_mileage')} км` : '' },
      { label: 'Объем двигателя', value: settings.watch('car_engine_vol') ? `${settings.watch('car_engine_vol')} см³` : '' },
      { label: 'Мощность', value: settings.watch('car_power') ? `${settings.watch('car_power')} л.с.` : '' },
      
      { label: 'Тип кузова', value: getName(BODY_TYPES, settings.watch('car_body')) },
      { label: 'Тип топлива', value: getName(FUEL_TYPES, settings.watch('car_fuel')) },
      { label: 'КПП', value: getName(GEARBOX_TYPES, settings.watch('car_gearbox')) },
      { label: 'Привод', value: getName(DRIVETRAIN_TYPES, settings.watch('car_drive')) },
      { label: 'Руль', value: getName(STEERING_TYPES, settings.watch('car_steering')) },
      { label: 'Цвет', value: getName(COLOR_TYPES, settings.watch('car_color')) },
      
      { label: 'Кол-во дверей', value: settings.watch('car_doors') },
      { label: 'Кол-во мест', value: settings.watch('car_seats') },
  ].filter(s => s.value); // Удаляем пустые

  return (
    <div className="w-full bg-white rounded-md overflow-hidden border border-gray-300 font-sans text-left shadow-lg select-none text-black">
      
      {/* Шапка объявления */}
      <div className="p-4 border-b border-gray-100 bg-gray-50">
          <h1 className="text-xl font-bold text-[#0079c2] mb-1 leading-snug">
              {displayTitle}
          </h1>
          <div className="flex justify-between items-end">
              <div className="text-2xl font-bold text-black flex items-baseline gap-2">
                  {price} <span className="text-sm font-normal text-gray-500 uppercase">{currency}</span>
                  {negotiable && <span className="text-xs text-green-600 font-normal border border-green-200 px-1 rounded">Торг</span>}
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
                    className={`w-16 h-12 flex-shrink-0 cursor-pointer border-2 ${activeImgIndex === idx ? 'border-[#ff6600]' : 'border-transparent'}`}
                  >
                      <img src={img.path} className="w-full h-full object-cover" />
                  </div>
              ))}
          </div>
      )}

      {/* Таблица характеристик (ВСЕ ПОЛЯ) */}
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