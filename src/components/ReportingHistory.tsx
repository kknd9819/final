import React from 'react';
import { SurveySubmission } from '../types';
import { Calendar, MapPin, Receipt, Trash2, Award, ClipboardCheck } from 'lucide-react';

interface ReportingHistoryProps {
  submissions: SurveySubmission[];
  onDelete: (id: number) => void;
  onClose: () => void;
}

export default function ReportingHistory({ submissions, onDelete, onClose }: ReportingHistoryProps) {
  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-sm rounded-2xl p-6 text-gray-900 dark:text-gray-100 max-w-2xl mx-auto my-6">
      <div className="flex justify-between items-center border-b border-gray-100 dark:border-gray-700 pb-4 mb-6">
        <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
          <Receipt className="w-5 h-5 text-blue-600 dark:text-blue-400" /> 
          我的提报记录
        </h3>
        <button 
          onClick={onClose}
          type="button"
          className="text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600 px-4 py-2 rounded-lg transition-colors"
        >
          返回收起
        </button>
      </div>

      {submissions.length === 0 ? (
        <div className="text-center py-12 text-gray-500 dark:text-gray-400 text-sm bg-gray-50 dark:bg-gray-700/50 rounded-xl border border-dashed border-gray-200 dark:border-gray-600">
          <Receipt className="w-10 h-10 mx-auto mb-3 text-gray-300 dark:text-gray-500" />
          暂无提报记录，完成您的第一份隐患提报进行备案。
        </div>
      ) : (
        <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2">
          {submissions.map((submission) => {
            const dateStr = new Date(submission.timestamp).toLocaleString('zh-CN', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            });

            const hazardCount = Object.values(submission.state.hazards).filter(h => h.checked).length + 
              (submission.state.othersText.trim() ? 1 : 0);

            return (
              <div 
                key={submission.id}
                className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl flex flex-col md:flex-row shadow-sm hover:shadow-md transition-shadow overflow-hidden"
              >
                <div className="flex-1 p-5 border-b md:border-b-0 md:border-r border-gray-100 dark:border-gray-700 flex flex-col justify-between">
                  <div className="flex justify-between items-start gap-4 mb-3">
                    <div>
                      <span className="text-xs font-medium bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-2.5 py-1 rounded-md border border-blue-100 dark:border-blue-800">
                        {submission.state.cinemaName || "未知电影院"}
                      </span>
                      <h4 className="text-base font-semibold mt-3 text-gray-900 dark:text-gray-100 flex items-center gap-1.5">
                        <MapPin className="w-4 h-4 text-gray-400 dark:text-gray-500" />
                        {submission.state.selectedCity} · {submission.state.selectedCounty}
                      </h4>
                    </div>
                    <div>
                      {submission.status === 'awarded' ? (
                        <span className="text-xs text-green-700 dark:text-green-300 bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 px-3 py-1.5 rounded-full flex items-center gap-1.5 font-medium">
                          <Award className="w-4 h-4" />
                          奖励核发
                        </span>
                      ) : (
                        <span className="text-xs text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 px-3 py-1.5 rounded-full flex items-center gap-1.5 font-medium">
                          <ClipboardCheck className="w-4 h-4" />
                          受理审核中
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="mt-4 space-y-2 text-sm text-gray-600 dark:text-gray-400">
                    <p className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-gray-400 dark:text-gray-500" />
                      提报日期: <span className="text-gray-900 dark:text-gray-100">{dateStr}</span>
                    </p>
                    <p className="pl-6">
                      提报人: <span className="text-gray-900 dark:text-gray-100">{submission.state.reporterName || "佚名"}{submission.state.reporterTitle} ({submission.state.reporterPhone.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2')})</span>
                    </p>
                    <div className="pt-3 mt-3 border-t border-gray-50 dark:border-gray-700 flex items-start flex-col gap-1.5 pl-6">
                      <p className="font-medium text-gray-900 dark:text-gray-100">登记隐患项 ({hazardCount}个):</p>
                      <ul className="list-disc list-inside space-y-1 text-gray-600 dark:text-gray-400 w-full text-xs">
                        {Object.entries(submission.state.hazards)
                          .filter(([_, value]) => value.checked)
                          .map(([key, value]) => {
                            const hazardLabels: { [k: string]: string } = {
                              '5': '指示牌/应急灯隐患',
                              '6': '安全出口异常锁闭、堵塞',
                              '7': '消防灭火器材缺失、损坏或过期',
                              '8': '防火卷帘下方堆放阻挡物',
                              '9': '用电安全隐患',
                              '10': '违规使用大功率取暖设备',
                              '16': '吸烟行为与禁烟警示缺失',
                              '12': '改变房屋主体物理结构',
                              '13': '未经审批审核的搭建加层',
                              '11': '卖品区卫生环境差',
                              '14': '售卖过期、变质食品',
                              '15': '未办理食品经营相关证照'
                            };
                            return (
                              <li key={key} className="truncate">
                                {hazardLabels[key] || `隐患项 ${key}`} 
                                {value.photos.length > 0 && <span className="text-blue-600 font-medium ml-1.5">({value.photos.length}图)</span>}
                              </li>
                            );
                          })}
                        {submission.state.othersText.trim() && (
                          <li className="truncate">
                            其他补充: {submission.state.othersText.substring(0, 15)}...
                            {submission.state.othersPhotos.length > 0 && <span className="text-blue-600 font-medium ml-1.5">({submission.state.othersPhotos.length}图)</span>}
                          </li>
                        )}
                      </ul>
                    </div>
                  </div>
                </div>

                <div className="w-full md:w-36 bg-gray-50 dark:bg-gray-700/50 p-5 flex flex-col justify-between items-center">
                  <div className="text-center w-full">
                    <div className="text-xl font-bold text-gray-900 dark:text-gray-100 mt-2">￥100</div>
                    <span className="text-[10px] text-gray-500 dark:text-gray-400 mt-1 block font-medium">审核通过奖</span>
                  </div>

                  <div className="my-4 text-center">
                    <span className="font-mono text-xs text-gray-400 dark:text-gray-500 block pb-1 border-b border-gray-200 dark:border-gray-600">#HN-{String(submission.id).padStart(6, '0')}</span>
                  </div>

                  <button
                    onClick={() => onDelete(submission.id)}
                    type="button"
                    className="text-gray-400 dark:text-gray-500 hover:text-red-500 dark:hover:text-red-400 p-2 rounded-full hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                    title="删除记录"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
