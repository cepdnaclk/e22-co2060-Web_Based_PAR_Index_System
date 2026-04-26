import React, { useState } from 'react';
import { UserIcon, BellIcon, ShieldIcon } from 'lucide-react';

export function Settings() {
  const [emailAlerts, setEmailAlerts] = useState(true);
  const [weeklyReports, setWeeklyReports] = useState(false);

  const handleSave = () => {
    alert("Settings saved successfully!");
  };

  return (
    <div className="p-6 md:p-8 h-full overflow-y-auto w-full max-w-4xl mx-auto">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900">Settings</h2>
        <p className="text-sm text-gray-500 mt-1">Manage your account and workspace preferences.</p>
      </div>

      <div className="space-y-6">
        {/* Profile Settings */}
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-3">
             <UserIcon className="text-gray-400" size={20} />
             <h3 className="font-semibold text-gray-900">Profile Settings</h3>
          </div>
          <div className="p-6 space-y-4">
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">First Name</label>
                    <input type="text" defaultValue="John" className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
                 </div>
                 <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Last Name</label>
                    <input type="text" defaultValue="Doe" className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
                 </div>
             </div>
             <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
                <input type="email" defaultValue="dr.doe@orthoclinic.com" className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
             </div>
             <div className="pt-2">
                 <button onClick={handleSave} className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition">Save Changes</button>
             </div>
          </div>
        </div>

        {/* Notifications */}
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-3">
             <BellIcon className="text-gray-400" size={20} />
             <h3 className="font-semibold text-gray-900">Notifications</h3>
          </div>
          <div className="p-6">
             <div className="flex items-center justify-between mb-4">
                <div className="pr-4">
                   <p className="font-medium text-gray-900 text-sm">Email Alerts</p>
                   <p className="text-xs sm:text-sm text-gray-500 mt-0.5">Receive email when new cases are added or PAR analysis succeeds.</p>
                </div>
                <div 
                   onClick={() => setEmailAlerts(!emailAlerts)}
                   className={`w-11 h-6 rounded-full relative cursor-pointer flex-shrink-0 transition-colors ${emailAlerts ? 'bg-blue-600' : 'bg-gray-200'}`}
                >
                   <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${emailAlerts ? 'left-[22px]' : 'left-1'}`}></div>
                </div>
             </div>
             <div className="flex items-center justify-between">
                <div className="pr-4">
                   <p className="font-medium text-gray-900 text-sm">Weekly Reports</p>
                   <p className="text-xs sm:text-sm text-gray-500 mt-0.5">Receive a summary of clinic activity every Monday.</p>
                </div>
                <div 
                   onClick={() => setWeeklyReports(!weeklyReports)}
                   className={`w-11 h-6 rounded-full relative cursor-pointer flex-shrink-0 transition-colors ${weeklyReports ? 'bg-blue-600' : 'bg-gray-200'}`}
                >
                   <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${weeklyReports ? 'left-[22px]' : 'left-1'}`}></div>
                </div>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
}
