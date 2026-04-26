import React from 'react';
import { FileBarChartIcon, DownloadIcon } from 'lucide-react';

export function Reports() {
  const handleExport = () => {
    alert("Exporting reports to CSV...");
  };

  return (
    <div className="p-6 md:p-8 h-full overflow-y-auto w-full max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Reports</h2>
          <p className="text-sm text-gray-500 mt-1">View and generate clinical reports.</p>
        </div>
        <button onClick={handleExport} className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition duration-200">
            <DownloadIcon size={18} />
            <span className="text-sm font-medium">Export</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex flex-col items-center text-center hover:shadow-md transition-shadow">
            <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mb-4">
                <FileBarChartIcon size={24} />
            </div>
            <h3 className="font-semibold text-gray-900 mb-2">Patient Demographics</h3>
            <p className="text-sm text-gray-500 mb-4">Overview of patient ages, genders, and locations.</p>
            <button className="mt-auto text-blue-600 text-sm font-medium hover:text-blue-700">View Report →</button>
        </div>
         <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex flex-col items-center text-center hover:shadow-md transition-shadow">
            <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mb-4">
                <FileBarChartIcon size={24} />
            </div>
            <h3 className="font-semibold text-gray-900 mb-2">Treatment Progress</h3>
            <p className="text-sm text-gray-500 mb-4">Statistics on PAR score improvements across cases.</p>
            <button className="mt-auto text-emerald-600 text-sm font-medium hover:text-emerald-700">View Report →</button>
        </div>
         <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex flex-col items-center text-center hover:shadow-md transition-shadow">
            <div className="w-12 h-12 bg-purple-50 text-purple-600 rounded-full flex items-center justify-center mb-4">
                <FileBarChartIcon size={24} />
            </div>
            <h3 className="font-semibold text-gray-900 mb-2">Clinic Activity</h3>
            <p className="text-sm text-gray-500 mb-4">Monthly breakdown of new cases and completed treatments.</p>
            <button className="mt-auto text-purple-600 text-sm font-medium hover:text-purple-700">View Report →</button>
        </div>
      </div>
    </div>
  );
}
