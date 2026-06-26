/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface HunanRegion {
  name: string;
  counties: string[];
}

export interface UploadedPhoto {
  id: string; // unique local ID
  name: string; // filename
  url: string; // data URL or mock temp URL
  size: string; // formatted size (e.g. "1.2 MB")
}

export interface SurveyState {
  // 基本信息
  reporterName: string;
  reporterTitle: '先生' | '女士' | '';
  reporterPhone: string;
  selectedCity: string;
  selectedCounty: string;
  cinemaName: string;

  // 举报内容 (Key: questionId: response)
  // response has true/false for checked, and an array of uploaded photos
  hazards: {
    [key: number]: {
      checked: boolean;
      photos: UploadedPhoto[];
    };
  };

  // 其他/第14题
  othersText: string;
  othersPhotos: UploadedPhoto[];
}


export interface QuestionDefinition {
  id: number;
  type: 'radio' | 'checkbox' | 'text' | 'region';
  title: string;
  desc?: string;
  placeholder?: string;
}

export interface SurveySubmission {
  id: string;
  timestamp: string;
  state: SurveyState;
  status: 'pending' | 'reviewing' | 'awarded' | 'invalid' | 'resolved';
  rewardAmount?: number;
}
