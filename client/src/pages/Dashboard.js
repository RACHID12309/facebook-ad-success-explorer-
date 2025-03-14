import React from 'react';
import { Link } from 'react-router-dom';

function Dashboard() {
  return (
    <div className="container mx-auto p-4">
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <h2 className="text-2xl font-bold mb-4">مرحبًا بك في منصة Facebook Ad Success Explorer</h2>
        <p className="text-gray-700 mb-4">
          استكشف أكثر إعلانات Facebook نجاحًا استنادًا إلى مقاييس الأداء.
        </p>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
          <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
            <h3 className="font-bold text-blue-700">مقاييس النجاح</h3>
            <p className="text-sm mt-2">استكشف كيفية تحديد نجاح الإعلانات</p>
            <Link to="/patterns" className="mt-3 inline-block text-blue-600 hover:underline">عرض المزيد &rarr;</Link>
          </div>
          
          <div className="bg-green-50 p-4 rounded-lg border border-green-200">
            <h3 className="font-bold text-green-700">بحث الإعلانات</h3>
            <p className="text-sm mt-2">ابحث عن الإعلانات باستخدام الكلمات المفتاحية والمرشحات</p>
            <Link to="/search" className="mt-3 inline-block text-green-600 hover:underline">البحث الآن &rarr;</Link>
          </div>
          
          <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
            <h3 className="font-bold text-purple-700">أنماط النجاح</h3>
            <p className="text-sm mt-2">اكتشف العناصر المشتركة في الإعلانات الناجحة</p>
            <Link to="/patterns" className="mt-3 inline-block text-purple-600 hover:underline">استكشاف الأنماط &rarr;</Link>
          </div>
        </div>
      </div>
      
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-xl font-bold mb-4">إحصائيات سريعة</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="border rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-blue-600">85%</div>
            <div className="text-sm text-gray-500">معدل النجاح المتوسط</div>
          </div>
          <div className="border rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-green-600">45+</div>
            <div className="text-sm text-gray-500">أيام متوسط مدة الإعلان</div>
          </div>
          <div className="border rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-purple-600">92%</div>
            <div className="text-sm text-gray-500">تستخدم دعوة للعمل</div>
          </div>
          <div className="border rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-orange-600">$750</div>
            <div className="text-sm text-gray-500">متوسط الإنفاق</div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;