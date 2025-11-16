import React, { useCallback, useMemo, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import axios from 'axios';
import toast, { Toaster } from 'react-hot-toast';
import '@fontsource/inter/400.css';
import '@fontsource/inter/700.css';
import '@fontsource/inter/900.css';
import './UploadPage.css';

const PROD_API_BASE = 'https://cursa.onrender.com';
const LOCAL_API_BASE = process.env.REACT_APP_LOCAL_API_BASE || 'http://127.0.0.1:5000';

const sanitizeBase = (value) => (value || '').replace(/\/$/, '');

const API_BASE = (() => {
  const envBase = process.env.REACT_APP_API_BASE;
  if (envBase) {
    return sanitizeBase(envBase);
  }

  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname || '';
    const isLocalhost = ['localhost', '127.0.0.1', '::1'].includes(hostname);
    const isDevTLD = hostname.endsWith('.local');
    if (isLocalhost || isDevTLD) {
      return sanitizeBase(LOCAL_API_BASE);
    }
  }

  return sanitizeBase(PROD_API_BASE);
})();

const UploadIcon = () => (
  <svg
    className="upload-page__icon"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.6"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M12 16V4" />
    <path d="M7 9l5-5 5 5" />
    <path d="M5 20h14" />
  </svg>
);

const ACCEPTED_TYPES = {
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
};

export default function UploadPage() {
  const [fileName, setFileName] = useState('');
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState('');
  const [reportData, setReportData] = useState(null);
  const [correctedReportData, setCorrectedReportData] = useState(null);
  const [correctedFilePath, setCorrectedFilePath] = useState('');
  const [correctionSuccess, setCorrectionSuccess] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  const resetResults = useCallback(() => {
    setReportData(null);
    setCorrectedReportData(null);
    setCorrectedFilePath('');
    setCorrectionSuccess(false);
  }, []);

  const triggerDirectDownload = useCallback(({ path, suggestedName }) => {
    if (!path) return;
    try {
      const base = API_BASE.endsWith('/') ? API_BASE : `${API_BASE}/`;
      const url = new URL('api/document/download-corrected', base);
      url.searchParams.set('path', path);
      if (suggestedName) {
        url.searchParams.set('filename', suggestedName);
      }

      const iframe = document.createElement('iframe');
      iframe.style.display = 'none';
      iframe.src = url.toString();
      document.body.appendChild(iframe);
      setTimeout(() => {
        iframe.remove();
      }, 120000);
    } catch (fallbackError) {
      console.error('Direct download fallback failed', fallbackError);
    }
  }, []);

  const downloadCorrectedDocument = useCallback(async ({
    path,
    suggestedName,
    silent = false,
    skipState = false,
  } = {}) => {
    if (!path) {
      if (!silent) {
        toast.error('Сервер не вернул путь к исправленному файлу');
      }
      return;
    }

    if (!skipState) {
      setIsDownloading(true);
    }

    try {
      const response = await axios.get(`${API_BASE}/api/document/download-corrected`, {
        params: {
          path,
          filename: suggestedName,
        },
        responseType: 'blob',
        timeout: 60000,
      });

      const blob = new Blob([response.data], {
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      });

      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      const disposition = response.headers?.['content-disposition'];
      let downloadName = suggestedName;

      if (disposition) {
        const utf8Match = /filename\*=UTF-8''([^;]+)/i.exec(disposition);
        const asciiMatch = /filename="?([^";]+)"?/i.exec(disposition);
        const rawName = (utf8Match && utf8Match[1]) || (asciiMatch && asciiMatch[1]);
        if (rawName) {
          try {
            downloadName = decodeURIComponent(rawName);
          } catch (decodeError) {
            downloadName = rawName;
          }
        }
      }

      if (!downloadName) {
        const parts = path.split(/[\\/]/);
        downloadName = parts[parts.length - 1];
      }

      if (downloadName && !/\.docx$/i.test(downloadName)) {
        downloadName = `${downloadName}.docx`;
      }

      link.href = url;
      link.setAttribute('download', downloadName || 'document.docx');
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      if (!silent) {
        toast.success('Исправленный файл скачан');
      }
    } catch (downloadError) {
      const isNetworkError = !downloadError?.response;
      if (isNetworkError) {
        triggerDirectDownload({ path, suggestedName });
        if (!silent) {
          toast('Браузеру не удалось получить файл через XHR, пробуем прямое скачивание…');
        }
      } else if (!silent) {
        const message = downloadError?.response?.data?.error || 'Не удалось скачать исправленный файл';
        toast.error(message);
      }
      if (!isNetworkError) {
        throw downloadError;
      }
    } finally {
      if (!skipState) {
        setIsDownloading(false);
      }
    }
  }, [triggerDirectDownload]);

  const handleUpload = useCallback(async (acceptedFiles) => {
    if (!acceptedFiles?.length) return;
    const file = acceptedFiles[0];
    resetResults();
    setFileName(file.name);
    setStatus('loading');
    setError('');

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await axios.post(`${API_BASE}/api/document/upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 60000,
      });
      const data = response?.data;

      if (!data || data.success !== true) {
        const message = data?.error || 'Не удалось обработать файл';
        throw new Error(message);
      }

      setReportData(data.check_results || null);
      setCorrectedReportData(data.corrected_check_results || null);
      setCorrectionSuccess(Boolean(data.correction_success));
      const correctedPath = data.corrected_file_path || data.corrected_path || '';
      setCorrectedFilePath(correctedPath);

      setStatus('success');
      toast.success(`Файл «${file.name}» проверен`);

      if (data.correction_success && correctedPath) {
        const baseName = (file.name || 'document').replace(/\.docx$/i, '') || 'document';
        const suggestedName = `${baseName}_corrected.docx`;
        downloadCorrectedDocument({
          path: correctedPath,
          suggestedName,
          silent: true,
          skipState: true,
        }).catch(() => {
          toast.error('Не удалось автоматически скачать исправленный файл. Используйте кнопку ниже.');
        });
      }
    } catch (err) {
      const message = err?.response?.data?.error || err?.message || 'Не удалось загрузить файл. Попробуйте ещё раз.';
      setStatus('error');
      setError(message);
      toast.error(message);
    }
  }, [downloadCorrectedDocument, resetResults]);

  const handleRejected = useCallback(() => {
    setStatus('error');
    const message = 'Поддерживается только .docx до 20 МБ';
    setError(message);
    toast.error(message);
  }, []);

  const {
    getRootProps,
    getInputProps,
    isDragActive,
    isDragReject,
    open,
  } = useDropzone({
    accept: ACCEPTED_TYPES,
    maxFiles: 1,
    maxSize: 20 * 1024 * 1024,
    onDrop: handleUpload,
    onDropRejected: handleRejected,
    noClick: true,
    noKeyboard: true,
  });

  const dropzoneClassName = useMemo(() => {
    const classes = ['upload-dropzone', 'glass-card'];
    if (isDragActive) classes.push('upload-dropzone--active');
    if (isDragReject) classes.push('upload-dropzone--reject');
    return classes.join(' ');
  }, [isDragActive, isDragReject]);

  const handleSelectClick = useCallback(() => {
    if (status !== 'loading') {
      open();
    }
  }, [open, status]);

  const totalIssues = reportData?.total_issues_count ?? 0;
  const correctedIssues = typeof correctedReportData?.total_issues_count === 'number'
    ? correctedReportData.total_issues_count
    : null;
  const improvementCount = typeof correctedIssues === 'number'
    ? Math.max(totalIssues - correctedIssues, 0)
    : null;
  const autoFixableCount = reportData?.statistics?.auto_fixable_count ?? 0;
  const severityStats = {
    high: reportData?.statistics?.severity?.high || 0,
    medium: reportData?.statistics?.severity?.medium || 0,
    low: reportData?.statistics?.severity?.low || 0,
  };

  const issuesPreview = useMemo(() => {
    const source = correctedReportData?.issues?.length
      ? correctedReportData.issues
      : reportData?.issues;
    if (!Array.isArray(source)) {
      return [];
    }
    return source.slice(0, 6);
  }, [reportData, correctedReportData]);

  const reportSummary = useMemo(() => {
    if (!reportData) return '';
    if (typeof correctedIssues === 'number') {
      if (correctedIssues === 0) {
        return 'Все несоответствия устранены автоматически. Можно скачать итоговую версию.';
      }
      if (improvementCount > 0) {
        return `Автоисправление устранило ${improvementCount} из ${totalIssues} несоответствий. Ниже список оставшихся пунктов.`;
      }
      return 'Автоисправление выполнено, но требуются ручные правки для полного соответствия.';
    }
    if (totalIssues === 0) {
      return 'Несоответствия не обнаружены.';
    }
    return 'Ниже список ключевых несоответствий, требующих внимания.';
  }, [reportData, correctedIssues, improvementCount, totalIssues]);

  const canDownload = correctionSuccess && Boolean(correctedFilePath);
  const downloadButtonLabel = isDownloading
    ? 'Скачивание…'
    : canDownload
      ? 'Скачать исправленный DOCX'
      : 'Исправленный файл недоступен';
  const severityLabelMap = {
    high: 'Критическая',
    medium: 'Средняя',
    low: 'Незначительная',
  };
  const showReport = Boolean(reportData);

  const handleDownloadClick = useCallback(() => {
    if (!correctionSuccess || !correctedFilePath) {
      toast.error('Исправленный файл ещё не готов');
      return;
    }

    const baseName = (fileName || correctedFilePath || 'document').replace(/\.docx$/i, '') || 'document';
    const suggestedName = `${baseName}_corrected.docx`;
    downloadCorrectedDocument({ path: correctedFilePath, suggestedName }).catch(() => {});
  }, [correctionSuccess, correctedFilePath, fileName, downloadCorrectedDocument]);

  const statusText = useMemo(() => {
    if (status === 'loading') {
      return 'Загрузка файла…';
    }
    if (status === 'success') {
      if (reportData) {
        if (typeof correctedIssues === 'number') {
          if (correctedIssues === 0) {
            return `Файл «${fileName}» проверен: все несоответствия устранены автоматически.`;
          }
          if (improvementCount > 0) {
            return `Файл «${fileName}» проверен: исправлено ${improvementCount} из ${totalIssues} несоответствий.`;
          }
          return `Файл «${fileName}» проверен: осталось ${correctedIssues} несоответствий.`;
        }
        if (totalIssues === 0) {
          return `Файл «${fileName}» проверен: несоответствий не найдено.`;
        }
        return `Файл «${fileName}» проверен: найдено ${totalIssues} несоответствий.`;
      }
      return fileName ? `Файл «${fileName}» успешно загружен` : 'Файл загружен';
    }
    if (status === 'error') {
      return error;
    }
    return '';
  }, [status, fileName, error, reportData, correctedIssues, improvementCount, totalIssues]);

  const statusClass = status === 'error'
    ? 'upload-status upload-status--error'
    : status === 'success'
      ? 'upload-status upload-status--success'
      : 'upload-status';

  return (
    <>
      <Toaster
        position="top-right"
        toastOptions={{
          style: { background: '#1c1d23', color: '#fff', border: '1px solid rgba(255,255,255,0.08)' },
        }}
      />
      <div className="upload-page">
        <div className="gradient-blur gradient-1" />
        <div className="gradient-blur gradient-2" />

        <div className="upload-page__content">
          <header className="upload-header">
            <h1 className="upload-title">CURSA</h1>
            <p className="upload-subtitle">Нормоконтроль нового поколения.</p>
            <p className="upload-description">
              Автоматическая проверка документов на соответствие стандартам ГОСТ.
            </p>
          </header>

          <main className="upload-main">
            <div className="upload-card">
              <div
                {...getRootProps({
                  onClick: handleSelectClick,
                  role: 'button',
                  tabIndex: 0,
                  onKeyDown: (event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      handleSelectClick();
                    }
                  },
                  'aria-label': 'Загрузить документ .docx',
                })}
                className={dropzoneClassName}
                data-loading={status === 'loading'}
              >
                <input {...getInputProps()} />
                <div className="upload-page__icon-wrapper">
                  <UploadIcon />
                </div>
                <div className="upload-text-center">
                  <p className="upload-step-title">Шаг 1: Загрузите документ</p>
                  <p className="upload-step-text">
                    Перетащите файл .docx сюда или выберите на вашем устройстве
                  </p>
                </div>
                <button
                  type="button"
                  className="upload-button"
                  onClick={(event) => {
                    event.stopPropagation();
                    handleSelectClick();
                  }}
                  disabled={status === 'loading'}
                >
                  {status === 'loading' ? 'Загрузка…' : 'Выбрать файл'}
                </button>
                {!!statusText && (
                  <p className={statusClass} aria-live="polite">
                    {statusText}
                  </p>
                )}
              </div>

              <div className="upload-text-center">
                {showReport ? (
                  <div className="upload-report glass-card">
                    <div className="upload-report__header">
                      <h2 className="upload-section-title">Результаты проверки</h2>
                      {!!reportSummary && <p className="upload-info">{reportSummary}</p>}
                    </div>

                    <div className="upload-report__stats">
                      {[
                        { label: 'Всего несоответствий', value: totalIssues },
                        { label: 'Критические', value: severityStats.high },
                        { label: 'Средние', value: severityStats.medium },
                        { label: 'Незначительные', value: severityStats.low },
                        { label: 'Автоисправимых', value: autoFixableCount },
                        typeof correctedIssues === 'number'
                          ? { label: 'После автоисправления', value: correctedIssues }
                          : null,
                      ]
                        .filter(Boolean)
                        .map((stat) => (
                          <div key={stat.label} className="upload-report__stat-card">
                            <p className="upload-report__stat-label">{stat.label}</p>
                            <p className="upload-report__stat-value">{stat.value ?? '—'}</p>
                          </div>
                        ))}
                    </div>

                    {issuesPreview.length > 0 ? (
                      <div className="upload-report__issues">
                        <p className="upload-report__issues-title">
                          {correctedIssues !== null
                            ? 'Что осталось исправить вручную'
                            : 'Что нужно поправить вручную'}
                        </p>
                        <div className="upload-report__issues-list">
                          {issuesPreview.map((issue, index) => (
                            <div key={`${issue.type || 'issue'}-${index}`} className="issue-card">
                              <span className={`issue-card__badge issue-card__badge--${issue.severity || 'low'}`}>
                                {severityLabelMap[issue.severity] || 'Замечание'}
                              </span>
                              <div className="issue-card__content">
                                <p className="issue-card__description">
                                  {issue.description || 'Описание недоступно'}
                                </p>
                                {issue.location && (
                                  <p className="issue-card__location">{issue.location}</p>
                                )}
                                {issue.auto_fixable && (
                                  <p className="issue-card__hint">Можно исправить автоматически</p>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <p className="upload-info upload-report__no-issues">
                        Все найденные несоответствия были устранены автоматически.
                      </p>
                    )}

                    <div className="upload-report__actions">
                      <button
                        type="button"
                        className="upload-button upload-button--secondary"
                        onClick={handleDownloadClick}
                        disabled={!canDownload || isDownloading}
                      >
                        {downloadButtonLabel}
                      </button>
                    </div>
                    {canDownload && (
                      <p className="download-hint">
                        Если загрузка не началась автоматически, нажмите кнопку выше.
                      </p>
                    )}
                  </div>
                ) : (
                  <>
                    <h2 className="upload-section-title">Что ожидать?</h2>
                    <p className="upload-info">
                      После загрузки и анализа документа здесь появится отчет об ошибках и возможность
                      скачать исправленную версию файла.
                    </p>
                    <button className="upload-disabled-button" type="button" disabled>
                      Скачивание станет доступно после проверки
                    </button>
                  </>
                )}
              </div>
            </div>
          </main>
        </div>
      </div>
    </>
  );
}
