import React, { useState, useEffect, useCallback, useRef } from 'react';
import ReactDOM from 'react-dom';
import { CreateModelModal } from './CreateModelModal';
import { KeywordTagsInput } from './KeywordTagsInput';
import { apiService } from '../../services/api';
import { UMLDiagram, UMLDiagramHandle } from '../canvas/UMLDiagram';
import { MetaModelFileDownloads } from './MetaModelFileDownloads';
import { MODAL_Z_INDEX, modalBackdropStyle, modalDialogShellStyle, useModalBodyLock } from './modalUtils';
import {
  METAMODEL_PREVIEW_LAYOUT_SCOPE,
  metaModelPreviewLayoutFileName,
} from '../../utils/metaModelPreview';

interface ToolsPanelProps {
  onEcoreFileUpload?: (fileContent: string, meta?: { fileName?: string; uploadId?: string; description?: string; keywords?: string; domain?: string; createdAt?: string }) => void;
  onEcoreFileDelete?: (fileName: string) => void;
  title?: string;
  allowCreate?: boolean;
  enableItemClick?: boolean;
  showBorder?: boolean;
  suppressApi?: boolean;
}

const toolsPanelStyle: React.CSSProperties = {
  userSelect: 'none',
  width: '100%',
  maxWidth: '100%',
  background: '#f8f9fa',
  padding: 'clamp(8px, 2vw, 16px)',
  boxSizing: 'border-box',
  height: 'auto',
  overflowY: 'auto',
  borderRight: '1px solid #e9ecef',
  minWidth: '200px',
};

const titleStyle: React.CSSProperties = {
  fontSize: '18px',
  fontWeight: 700,
  marginBottom: '16px',
  color: '#2c3e50',
  textAlign: 'left',
  padding: '8px 0',
  borderBottom: '2px solid #049484',
  fontFamily: 'Georgia, serif',
};

const createButtonStyle: React.CSSProperties = {
  width: '100%',
  padding: '12px 18px',
  marginBottom: '12px',
  border: 'none',
  borderRadius: '8px',
  background: 'linear-gradient(135deg, #049484 0%, #037368 100%)',
  color: '#ffffff',
  fontSize: '15px',
  fontWeight: 600,
  cursor: 'pointer',
  transition: 'all 0.3s ease',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '10px',
  userSelect: 'none',
  boxShadow: '0 2px 8px rgba(4, 148, 132, 0.25)',
  fontFamily: 'Georgia, serif',
};

const createButtonHoverStyle: React.CSSProperties = {
  transform: 'translateY(-1px)',
  boxShadow: '0 4px 12px rgba(4, 148, 132, 0.35)',
  background: 'linear-gradient(135deg, #037368 0%, #025850 100%)',
};

const standardButtonStyle: React.CSSProperties = {
  padding: '10px 16px',
  borderRadius: '8px',
  border: '1px solid #e5e7eb',
  background: '#ffffff',
  cursor: 'pointer',
  fontWeight: 600,
  fontSize: 14,
  color: '#374151',
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  transition: 'all 0.2s ease',
  outline: 'none',
  whiteSpace: 'nowrap',
};

const standardButtonHoverStyle: React.CSSProperties = {
  background: '#f9fafb',
  borderColor: '#d1d5db',
};

const filterContainerStyle: React.CSSProperties = {
  position: 'fixed',
  top: '230px',
  left: '16px',
  right: '16px',
  zIndex: 1000,
  padding: '12px',
  background: '#ffffff',
  maxWidth: '320px',
  borderRadius: '8px',
  border: '1px solid #e9ecef',
  boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
};

const filterCloseButtonStyle: React.CSSProperties = {
  position: 'absolute',
  top: '6px',
  right: '6px',
  width: '24px',
  height: '24px',
  border: 'none',
  background: 'transparent',
  color: '#6c757d',
  fontSize: '16px',
  lineHeight: '24px',
  cursor: 'pointer',
  borderRadius: '6px',
};

const filterRowStyle: React.CSSProperties = {
  display: 'flex',
  gap: '8px',
  marginBottom: '8px',
  alignItems: 'center',
};

const filterLabelStyle: React.CSSProperties = {
  fontSize: '12px',
  fontWeight: '600',
  color: '#495057',
  minWidth: '60px',
};

const filterInputStyle: React.CSSProperties = {
  flex: '1',
  padding: '8px 10px',
  border: '1px solid #e5e7eb',
  borderRadius: '8px',
  fontSize: '13px',
  outline: 'none',
  transition: 'border-color 0.2s ease',
};

const filterSelectStyle: React.CSSProperties = {
  flex: '1',
  padding: '8px 10px',
  border: '1px solid #e5e7eb',
  borderRadius: '8px',
  fontSize: '13px',
  background: '#ffffff',
  cursor: 'pointer',
  outline: 'none',
  transition: 'border-color 0.2s ease',
};

const fileCardStyle: React.CSSProperties = {
  background: '#ffffff',
  border: '1px solid #e5e7eb',
  borderRadius: '12px',
  padding: '16px',
  marginBottom: '10px',
  boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
  transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
  cursor: 'pointer',
};

const fileCardHoverStyle: React.CSSProperties = {
  boxShadow: '0 8px 24px rgba(4, 148, 132, 0.15)',
  transform: 'translateY(-2px)',
  borderColor: '#049484',
};

const emptyStateStyle: React.CSSProperties = {
  height: 'calc(100vh - 254px)',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 12,
  fontSize: '14px',
  color: '#6b7280',
  textAlign: 'center',
  padding: '24px',
};

const paginationContainerStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '12px 0',
  marginTop: '8px',
  borderTop: '1px solid #e9ecef',
  fontFamily: 'Georgia, serif',
};

const paginationInfoStyle: React.CSSProperties = {
  fontSize: '12px',
  color: '#6c757d',
  fontWeight: '500',
};

const paginationControlsStyle: React.CSSProperties = {
  display: 'flex',
  gap: '4px',
  alignItems: 'center',
};

const paginationButtonStyle: React.CSSProperties = {
  padding: '8px 12px',
  border: '1px solid #e5e7eb',
  borderRadius: '8px',
  background: '#ffffff',
  color: '#374151',
  fontSize: '13px',
  fontWeight: '600',
  cursor: 'pointer',
  transition: 'all 0.2s ease',
  minWidth: '36px',
  textAlign: 'center',
};

const paginationButtonHoverStyle: React.CSSProperties = {
  background: '#f9fafb',
  borderColor: '#d1d5db',
};

const paginationButtonActiveStyle: React.CSSProperties = {
  background: '#049484',
  color: '#ffffff',
  borderColor: '#049484',
  boxShadow: '0 2px 4px rgba(4, 148, 132, 0.2)',
};

const paginationButtonDisabledStyle: React.CSSProperties = {
  background: '#f9fafb',
  color: '#9ca3af',
  borderColor: '#e5e7eb',
  cursor: 'not-allowed',
  opacity: 0.6,
};

const filterTagStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  padding: '2px 8px',
  borderRadius: '16px',
  fontSize: '11px',
  fontWeight: '500',
  color: '#0366d6',
  background: '#f1f8ff',
  border: '1px solid #c8e1ff',
  margin: '2px',
  userSelect: 'none',
};

const filterTagsContainerStyle: React.CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: '4px',
  marginBottom: '8px',
  minHeight: '24px',
};

const enhancedSearchInputStyle: React.CSSProperties = {
  ...filterInputStyle,
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif',
  fontSize: '13px',
};

// Pure helper functions moved outside component to avoid recreation on each render
const SEARCH_KEY_MAP: Record<string, string> = {
  name: 'name',
  domain: 'domain',
  keyword: 'keywords',
  keywords: 'keywords',
  description: 'description',
  desc: 'description',
  created: 'created',
  updated: 'updated',
};

const tokenizeQuery = (query: string): string[] => {
  const tokens: string[] = [];
  let current = '';
  let inQuotes = false;
  
  for (const ch of query) {
    if (ch === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    const isWhitespace = !inQuotes && /\s/.test(ch);
    if (isWhitespace) {
      if (current.trim()) tokens.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  
  if (current.trim()) tokens.push(current);
  return tokens;
};

const parseTimeFilter = (cleanValue: string) => {
  const isBeforeNow = cleanValue === 'beforenow' || cleanValue === 'before:now';
  if (isBeforeNow) {
    return { key: 'created', value: 'before:now', display: 'time:beforenow' };
  }
  const isAfterNow = cleanValue === 'afternow' || cleanValue === 'after:now';
  if (isAfterNow) {
    return { key: 'created', value: 'after:now', display: 'time:afternow' };
  }
  return { key: 'created', value: cleanValue, display: `time:${cleanValue}` };
};

const parseDateValue = (dateStr: string): string => {
  return dateStr === 'now' ? new Date().toISOString() : new Date(dateStr).toISOString();
};

const parseDateRangeFilter = (value: string): { from?: string; to?: string } => {
  const v = String(value);
  
  if (v.includes('after:')) {
    return { from: parseDateValue(v.replace('after:', '')) };
  }
  if (v.includes('before:')) {
    return { to: parseDateValue(v.replace('before:', '')) };
  }
  if (v.includes('between:')) {
    const dates = v.replace('between:', '').split('..');
    if (dates.length === 2) {
      return { from: new Date(dates[0]).toISOString(), to: new Date(dates[1]).toISOString() };
    }
    return {};
  }
  if (v === 'before:now') {
    return { to: new Date().toISOString() };
  }
  if (v === 'after:now') {
    return { from: new Date().toISOString() };
  }
  return { from: new Date(v).toISOString(), to: new Date(`${v}T23:59:59`).toISOString() };
};

export const ToolsPanel: React.FC<ToolsPanelProps> = ({ onEcoreFileUpload, onEcoreFileDelete, title = 'Meta Models', allowCreate = true, enableItemClick = true, showBorder = true, suppressApi = false }) => {
  const [isProcessing] = useState(false);
  const [uploadMessage, setUploadMessage] = useState<string>('');
  const [uploadMessageType, setUploadMessageType] = useState<'success' | 'error'>('success');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState<string>('all');
  const [showFilters, setShowFilters] = useState(false);
  const [sortBy, setSortBy] = useState<'name' | 'date' | 'domain'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [isLoadingModels, setIsLoadingModels] = useState(false);
  const [apiModels, setApiModels] = useState<any[]>([]);
  const [apiError, setApiError] = useState<string>('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const [parsedFilters, setParsedFilters] = useState<any[]>([]);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string>('');
  const [viewModel, setViewModel] = useState<any>(null);
  const [showAllModels, setShowAllModels] = useState(false);
  const [metaModelModalTab, setMetaModelModalTab] = useState<'details' | 'edit'>('details');
  const [metaModelDeleteConfirmOpen, setMetaModelDeleteConfirmOpen] = useState(false);
  const [metaModelDeleting, setMetaModelDeleting] = useState(false);
  const [metaModelDeleteError, setMetaModelDeleteError] = useState<string>('');
  
  // Edit form state
  const [editFormData, setEditFormData] = useState({
    name: '',
    description: '',
    domain: '',
    keywords: [] as string[],
  });
  const [isEditLoading, setIsEditLoading] = useState(false);
  const [editError, setEditError] = useState<string>('');
  const [editSuccess, setEditSuccess] = useState<string>('');
  const isEditSubmitDisabled =
    isEditLoading ||
    !editFormData.name.trim() ||
    !editFormData.description.trim() ||
    !editFormData.domain.trim() ||
    editFormData.keywords.length === 0;

  // UML preview state for model detail modal
  const diagramRef = useRef<UMLDiagramHandle>(null);
  const [umlContent, setUmlContent] = useState<string | null>(null);
  const [umlFetching, setUmlFetching] = useState(false);
  const [umlError, setUmlError] = useState(false);

  useEffect(() => {
    if (!viewModel?.ecoreFileId) { setUmlContent(null); setUmlError(false); return; }
    setUmlFetching(true); setUmlContent(null); setUmlError(false);
    apiService.getFile(viewModel.ecoreFileId)
      .then(c => setUmlContent(c))
      .catch(() => setUmlError(true))
      .finally(() => setUmlFetching(false));
  }, [viewModel?.ecoreFileId]);

  useEffect(() => {
    if (!umlContent || !viewModel) return;
    const t = setTimeout(() => diagramRef.current?.fitToView(), 150);
    return () => clearTimeout(t);
  }, [umlContent, viewModel?.id, viewModel?.name]);

  useModalBodyLock(!!viewModel || metaModelDeleteConfirmOpen || deleteConfirmOpen);

  const resetMetaModelModalState = () => {
    setViewModel(null);
    setMetaModelModalTab('details');
    setEditError('');
    setEditSuccess('');
    setUmlContent(null);
    setUmlError(false);
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Tab') return;
    const input = e.currentTarget;
    const value = input.value;
    const caret = input.selectionStart ?? value.length;
    let start = caret - 1;
    while (start >= 0 && !/\s/.test(value[start])) start--;
    start++;
    let end = caret;
    while (end < value.length && !/\s/.test(value[end])) end++;
    const token = value.slice(start, end);
    const lower = token.toLowerCase().replace(/:$/, '');

    const candidates = ['name', 'description', 'domain', 'keywords', 'created', 'updated', 'time'];
    const match = candidates.find(k => k.startsWith(lower));
    const replacement = match ? `${match}:` : null;
    if (!replacement) return;

    e.preventDefault();
    const newValue = value.slice(0, start) + replacement + value.slice(end);
    const newCaret = start + replacement.length;
    setSearchTerm(newValue);
    requestAnimationFrame(() => {
      input.setSelectionRange(newCaret, newCaret);
    });
  };

  const parseSearchQuery = useCallback((query: string) => {
    const result: any[] = [];
    const tokens = tokenizeQuery(query);

    for (const token of tokens) {
      const match = /^([a-zA-Z]+):(.+)$/.exec(token);
      if (!match) continue;

      const key = match[1].toLowerCase();
      const cleanValue = match[2].trim();

      if (key === 'time') {
        result.push(parseTimeFilter(cleanValue));
        continue;
      }

      const mappedKey = SEARCH_KEY_MAP[key];
      if (mappedKey) {
        result.push({ key: mappedKey, value: cleanValue, display: `${mappedKey}:${cleanValue}` });
      }
    }

    return result;
  }, []);

  const getLegacyDateFrom = (filter: string): Date => {
    const now = new Date();
    const dateMap: Record<string, () => Date> = {
      today: () => new Date(now.getFullYear(), now.getMonth(), now.getDate()),
      week: () => new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
      month: () => new Date(now.getFullYear(), now.getMonth(), 1),
      year: () => new Date(now.getFullYear(), 0, 1),
    };
    return dateMap[filter]?.() ?? new Date(0);
  };

  const applyFilterToResult = useCallback((filters: any, filter: { key: string; value: string }) => {
    const simpleKeys = ['name', 'domain', 'description'];
    if (simpleKeys.includes(filter.key)) {
      filters[filter.key] = filter.value;
      return;
    }

    if (filter.key === 'keywords') {
      const values = String(filter.value).split(',').map(v => v.trim()).filter(v => v.length > 0);
      if (values.length > 0) filters.keyword = values;
      return;
    }

    if (filter.key === 'created') {
      const range = parseDateRangeFilter(filter.value);
      if (range.from) filters.createdFrom = range.from;
      if (range.to) filters.createdTo = range.to;
      return;
    }

    if (filter.key === 'updated') {
      const range = parseDateRangeFilter(filter.value);
      if (range.from) filters.updatedFrom = range.from;
      if (range.to) filters.updatedTo = range.to;
    }
  }, []);

  const buildApiFiltersFromParsedFilters = useCallback((filtersParsed: any[], includeLegacyDate = true) => {
    const filters: any = {};
    filters.ownedByUser = !showAllModels;
    
    filtersParsed.forEach(filter => applyFilterToResult(filters, filter));

    const shouldApplyLegacyDate = includeLegacyDate && dateFilter !== 'all';
    const hasDateFilters = filters.createdFrom || filters.createdTo || filters.updatedFrom || filters.updatedTo;
    
    if (shouldApplyLegacyDate && !hasDateFilters) {
      const now = new Date();
      filters.createdFrom = getLegacyDateFrom(dateFilter).toISOString();
      filters.createdTo = now.toISOString();
    }

    return filters;
  }, [dateFilter, showAllModels, applyFilterToResult]);

  // Debounce search term for live search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 500); // 500ms delay

    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Parse the debounced search term
  useEffect(() => {
    const term = debouncedSearchTerm.trim();
    if (term) {
      // If no ":" found, treat as simple name search
      const finalTerm = term.includes(':') ? term : `name:${term}`;
      const filters = parseSearchQuery(finalTerm);
      setParsedFilters(filters);
    } else {
      setParsedFilters([]);
    }
  }, [debouncedSearchTerm, parseSearchQuery]);

  // Initialize edit form when viewModel changes
  useEffect(() => {
    if (viewModel) {
      setEditFormData({
        name: viewModel.name || '',
        description: viewModel.description || '',
        domain: viewModel.domain || '',
        keywords: viewModel.keyword || [],
      });
      setEditError('');
      setEditSuccess('');
    }
  }, [viewModel]);

  useEffect(() => {
    if (suppressApi) {
      setIsLoadingModels(false);
      setApiError('');
      setApiModels([]);
      return;
    }
    const fetchData = async () => {
      setIsLoadingModels(true);
      setApiError('');
      
      try {
        const filters = buildApiFiltersFromParsedFilters(parsedFilters, true);
        
        const response = await apiService.findMetaModels(filters);
        setApiModels(response.data || []);
        setCurrentPage(1);
      } catch (error) {
        console.error('Error fetching meta models from API:', error);
        setApiError(error instanceof Error ? error.message : 'Failed to fetch meta models');
      } finally {
        setIsLoadingModels(false);
      }
    };
    
    fetchData();
  }, [parsedFilters, dateFilter, suppressApi, showAllModels, buildApiFiltersFromParsedFilters]);

  const sortedModels = [...apiModels].sort((a, b) => {
    let comparison = 0;
    
    switch (sortBy) {
      case 'name':
        comparison = a.name.localeCompare(b.name);
        break;
      case 'date':
        comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        break;
      case 'domain':
        comparison = (a.domain || '').localeCompare(b.domain || '');
        break;
    }
    
    return sortOrder === 'asc' ? comparison : -comparison;
  });

  const totalItems = sortedModels.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentPageItems = sortedModels.slice(startIndex, endIndex);

  const goToPage = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  const goToPreviousPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };

  const goToNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
    }
  };

  const handleButtonClick = () => {
    setShowCreateModal(true);
  };

  const panelStyle: React.CSSProperties = { ...toolsPanelStyle, borderRight: showBorder ? toolsPanelStyle.borderRight : 'none' };

  const handleConfirmDelete = async () => {
    if (!deletingId) return;
    try {
      await apiService.deleteMetaModel(deletingId);
      setUploadMessage('Meta Model deleted successfully!');
      setUploadMessageType('success');
      const filters = buildApiFiltersFromParsedFilters(parsedFilters, true);
      const response = await apiService.findMetaModels(filters);
      setApiModels(response.data || []);
      setDeleteConfirmOpen(false);
      setDeletingId(null);
      setDeleteError('');
      setTimeout(() => setUploadMessage(''), 3000);
    } catch (error: any) {
      let msg = 'Failed to delete meta model';
      if (error?.response?.data?.message) {
        msg = error.response.data.message;
      } else if (error?.message) {
        msg = error.message;
      }
      setDeleteError(msg);
      setUploadMessage(msg);
      setUploadMessageType('error');
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!viewModel?.id) return;
    
    setIsEditLoading(true);
    setEditError('');
    setEditSuccess('');

    try {
      await apiService.updateMetaModel(String(viewModel.id), {
        name: editFormData.name.trim(),
        description: editFormData.description.trim(),
        domain: editFormData.domain.trim(),
        keyword: editFormData.keywords,
        ecoreFileId: viewModel.ecoreFileId || 0,
        genModelFileId: viewModel.genModelFileId || 0,
      });

      setEditSuccess('Meta model updated successfully!');
      
      // Refresh the models list and update viewModel
      const filters = buildApiFiltersFromParsedFilters(parsedFilters, true);
      const listResponse = await apiService.findMetaModels(filters);
      setApiModels(listResponse.data || []);
      
      // Update viewModel with fresh data
      try {
        const modelResponse = await apiService.getMetaModel(String(viewModel.id));
        if (modelResponse.data) {
          setViewModel(modelResponse.data);
        }
      } catch (modelError) {
        console.error('Failed to fetch updated model details, using data from list:', modelError);
        const updatedModel = listResponse.data?.find((m: any) => m.id === viewModel.id);
        if (updatedModel) {
          setViewModel(updatedModel);
        }
      }
      
      // Switch back to details tab after successful save
      setTimeout(() => {
        setMetaModelModalTab('details');
        setEditSuccess('');
      }, 1500);
    } catch (err: any) {
      setEditError(err?.response?.data?.message || err?.message || 'Failed to update meta model');
    } finally {
      setIsEditLoading(false);
    }
  };

  const renderMainPanelContentMarkup = () => {
    const isUploadSuccess = uploadMessageType === 'success';
    const uploadMessageStyle: React.CSSProperties = {
      padding: '10px 14px',
      margin: '8px 0',
      borderRadius: '8px',
      fontSize: '13px',
      fontWeight: '500',
      backgroundColor: isUploadSuccess ? '#d4edda' : '#f8d7da',
      color: isUploadSuccess ? '#155724' : '#721c24',
      border: `1px solid ${isUploadSuccess ? '#c3e6cb' : '#f5c6cb'}`,
    };
    const createButtonLabel = isProcessing ? 'Building...' : 'Import Meta Model';
    const myModelsActive = !showAllModels;
    const allModelsActive = showAllModels;
    const baseTabStyle: React.CSSProperties = {
      flex: 1,
      padding: '12px 16px',
      border: 'none',
      fontWeight: 700,
      fontSize: 14,
      cursor: 'pointer',
      transition: 'all 0.2s ease',
      fontFamily: 'Georgia, serif',
    };
    const myModelsTabStyle: React.CSSProperties = {
      ...baseTabStyle,
      borderBottom: myModelsActive ? '3px solid #049484' : '3px solid transparent',
      background: myModelsActive ? '#f0f9ff' : 'transparent',
      color: myModelsActive ? '#049484' : '#6b7280',
    };
    const allModelsTabStyle: React.CSSProperties = {
      ...baseTabStyle,
      borderBottom: allModelsActive ? '3px solid #049484' : '3px solid transparent',
      background: allModelsActive ? '#f0f9ff' : 'transparent',
      color: allModelsActive ? '#049484' : '#6b7280',
    };
    const activeFilterLabel = `${parsedFilters.length} filter${parsedFilters.length > 1 ? 's' : ''} active`;

    return (
    <div style={panelStyle}>
      <div style={titleStyle}>
        {title}
      </div>
      
      {uploadMessage && (
        <div style={uploadMessageStyle}>
          {uploadMessage}
        </div>
      )}
      
      <button 
        style={createButtonStyle}
        onClick={handleButtonClick}
        disabled={isProcessing}
        onMouseEnter={(e) => !isProcessing && Object.assign(e.currentTarget.style, createButtonHoverStyle)}
        onMouseLeave={(e) => !isProcessing && Object.assign(e.currentTarget.style, createButtonStyle)}
      >
        {createButtonLabel}
      </button>

      {!suppressApi && (
        <>
          {/* View Toggle Tabs */}
          <div style={{ 
            display: 'flex', 
            gap: 0, 
            marginBottom: 16,
            borderBottom: '2px solid #e5e7eb',
          }}>
            <button
              onClick={() => setShowAllModels(false)}
              style={myModelsTabStyle}
              onMouseEnter={(e) => {
                if (!myModelsActive) e.currentTarget.style.background = '#f9fafb';
              }}
              onMouseLeave={(e) => {
                if (!myModelsActive) e.currentTarget.style.background = 'transparent';
              }}
            >
              My Models
            </button>
            <button
              onClick={() => setShowAllModels(true)}
              style={allModelsTabStyle}
              onMouseEnter={(e) => {
                if (!allModelsActive) e.currentTarget.style.background = '#f9fafb';
              }}
              onMouseLeave={(e) => {
                if (!allModelsActive) e.currentTarget.style.background = 'transparent';
              }}
            >
              All Models
            </button>
          </div>

          {/* Search Bar */}
          <div style={{ position: 'relative', marginBottom: 12 }}>
            <svg 
              style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }}
              width="16" 
              height="16" 
              viewBox="0 0 24 24" 
              fill="none" 
              stroke="currentColor" 
              strokeWidth="2"
            >
              <circle cx="11" cy="11" r="8"/>
              <path d="m21 21-4.35-4.35"/>
            </svg>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  // Immediately trigger search by updating debounced term
                  const currentTerm = searchTerm.trim();
                  const finalTerm = currentTerm && !currentTerm.includes(':') ? `name:${currentTerm}` : currentTerm;
                  setDebouncedSearchTerm(finalTerm);
                }
              }}
              placeholder="Search models by name..."
              style={{
                width: '100%',
                padding: '12px 14px 12px 42px',
                borderRadius: '8px',
                border: '2px solid #e5e7eb',
                fontSize: 14,
                outline: 'none',
                transition: 'all 0.2s ease',
                boxSizing: 'border-box',
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = '#049484';
                e.currentTarget.style.boxShadow = '0 0 0 3px rgba(4, 148, 132, 0.1)';
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = '#e5e7eb';
                e.currentTarget.style.boxShadow = 'none';
              }}
            />
          </div>

          {/* Filter Actions Row */}
          <div style={{ 
            display: 'flex', 
            gap: 8, 
            marginBottom: 12, 
            alignItems: 'center',
            flexWrap: 'wrap',
          }}>
            <select
              value={`${sortBy}-${sortOrder}`}
              onChange={(e) => {
                const [newSortBy, newSortOrder] = e.target.value.split('-') as ['name' | 'date' | 'domain', 'asc' | 'desc'];
                setSortBy(newSortBy);
                setSortOrder(newSortOrder);
              }}
              style={{
                ...standardButtonStyle,
                flex: 1,
                minWidth: 140,
              }}
              onMouseEnter={(e) => Object.assign(e.currentTarget.style, standardButtonHoverStyle)}
              onMouseLeave={(e) => Object.assign(e.currentTarget.style, standardButtonStyle)}
            >
              <option value="date-desc">Newest First</option>
              <option value="date-asc">Oldest First</option>
              <option value="name-asc">Name A-Z</option>
              <option value="name-desc">Name Z-A</option>
              <option value="domain-asc">Domain A-Z</option>
              <option value="domain-desc">Domain Z-A</option>
            </select>
            
            <button
              onClick={() => setShowFilters(!showFilters)}
              style={{
                ...standardButtonStyle,
                background: showFilters ? '#049484' : '#ffffff',
                color: showFilters ? '#ffffff' : '#374151',
                borderColor: showFilters ? '#049484' : '#e5e7eb',
              }}
              onMouseEnter={(e) => {
                if (showFilters) {
                  return;
                }
                Object.assign(e.currentTarget.style, standardButtonHoverStyle);
              }}
              onMouseLeave={(e) => {
                if (showFilters) {
                  e.currentTarget.style.background = '#049484';
                  e.currentTarget.style.borderColor = '#049484';
                } else {
                  e.currentTarget.style.background = '#ffffff';
                  e.currentTarget.style.borderColor = '#e5e7eb';
                }
              }}
            >
              Advanced Filters
            </button>
          </div>

          {/* Active Filter Count Badge */}
          {parsedFilters.length > 0 && (
            <div style={{
              padding: '8px 12px',
              marginBottom: 12,
              background: '#f0f9ff',
              border: '1px solid #bae6fd',
              borderRadius: 8,
              fontSize: 12,
              color: '#0369a1',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}>
              <span style={{ fontWeight: 600 }}>{activeFilterLabel}</span>
              <button
                onClick={() => setSearchTerm('')}
                style={{
                  marginLeft: 'auto',
                  padding: '4px 8px',
                  background: '#ffffff',
                  border: '1px solid #bae6fd',
                  borderRadius: 6,
                  fontSize: 11,
                  cursor: 'pointer',
                  fontWeight: 600,
                  color: '#0369a1',
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = '#f0f9ff'}
                onMouseLeave={(e) => e.currentTarget.style.background = '#ffffff'}
              >
                Clear All
              </button>
            </div>
          )}
        </>
      )}

      {showFilters && (
        <div style={filterContainerStyle}>
          <button
            aria-label="Close filters"
            title="Close"
            style={filterCloseButtonStyle}
            onClick={() => setShowFilters(false)}
            onMouseEnter={(e) => { e.currentTarget.style.background = '#f1f3f5'; e.currentTarget.style.color = '#495057'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#6c757d'; }}
          >
            ×
          </button>
          <div style={{ fontSize: '12px', fontWeight: '600', color: '#495057', marginBottom: '8px' }}>
            Advanced Search
          </div>
          
          {parsedFilters.length > 0 && (
            <div style={filterTagsContainerStyle}>
              {parsedFilters.map((filter) => (
                <div key={`${filter.key}-${filter.value}`} style={filterTagStyle}>
                  {filter.display}
                </div>
              ))}
            </div>
          )}
          
          <div style={filterRowStyle}>
            <span style={filterLabelStyle}>Search:</span>
            <input
              type="text"
              placeholder="name:test domain:engineering time:beforenow created:after:2023-01-01"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={enhancedSearchInputStyle}
              onKeyDown={handleSearchKeyDown}
            />
          </div>
          
          <div style={{ fontSize: '10px', color: '#6a737d', marginTop: '4px', fontStyle: 'italic' }}>
            Use GitHub-style syntax: name:test domain:engineering time:beforenow created:after:2023-01-01
          </div>
          
          <div style={filterRowStyle}>
            <span style={filterLabelStyle}>Date:</span>
            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              style={filterSelectStyle}
            >
              <option value="all">All time</option>
              <option value="today">Today</option>
              <option value="week">This week</option>
              <option value="month">This month</option>
              <option value="year">This year</option>
            </select>
          </div>
          
          <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid #e9ecef' }}>
            <div style={{ fontSize: '12px', fontWeight: '600', color: '#495057', marginBottom: '8px' }}>
              Quick Filters
            </div>
            
            <div style={filterRowStyle}>
              <span style={filterLabelStyle}>Name:</span>
              <input
                type="text"
                placeholder="Filter by name..."
                style={filterInputStyle}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    const value = e.currentTarget.value.trim();
                    if (value) {
                      setSearchTerm(prev => prev ? `${prev} name:${value}` : `name:${value}`);
                      e.currentTarget.value = '';
                    }
                  }
                }}
              />
            </div>
            
            <div style={filterRowStyle}>
              <span style={filterLabelStyle}>Domain:</span>
              <input
                type="text"
                placeholder="Filter by domain..."
                style={filterInputStyle}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    const domainValue = e.currentTarget.value.trim();
                    if (domainValue) {
                      setSearchTerm(prev => prev ? `${prev} domain:${domainValue}` : `domain:${domainValue}`);
                      e.currentTarget.value = '';
                    }
                  }
                }}
              />
            </div>
            
            <div style={filterRowStyle}>
              <span style={filterLabelStyle}>Keywords:</span>
              <input
                type="text"
                placeholder="Filter by keywords..."
                style={filterInputStyle}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    const keywordValue = e.currentTarget.value.trim();
                    if (keywordValue) {
                      setSearchTerm(prev => prev ? `${prev} keywords:${keywordValue}` : `keywords:${keywordValue}`);
                      e.currentTarget.value = '';
                    }
                  }
                }}
              />
            </div>
            
            <div style={filterRowStyle}>
              <span style={filterLabelStyle}>Date:</span>
              <input
                type="date"
                style={filterInputStyle}
                onChange={(e) => {
                  const dateValue = e.target.value;
                  if (dateValue) {
                    setSearchTerm(prev => prev ? `${prev} created:${dateValue}` : `created:${dateValue}`);
                  }
                }}
              />
            </div>
          </div>
        </div>
      )}

      {!suppressApi && apiError && (
        <div style={{
          padding: '10px 14px',
          margin: '8px 0',
          borderRadius: '8px',
          fontSize: '13px',
          fontWeight: '500',
          backgroundColor: '#f8d7da',
          color: '#721c24',
          border: '1px solid #f5c6cb',
        }}>
          {apiError}
        </div>
      )}

      {!suppressApi && isLoadingModels && (
        <div style={{
          padding: '32px 16px',
          textAlign: 'center',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 12,
        }}>
          <div style={{
            width: 40,
            height: 40,
            border: '4px solid #e5e7eb',
            borderTop: '4px solid #049484',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
          }} />
          <div style={{
            fontSize: '14px',
            color: '#6b7280',
            fontWeight: 500,
          }}>
            Loading models...
          </div>
          <style>{`
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
          `}</style>
        </div>
      )}

      {!suppressApi && (
      <div style={{ 
        height: 'calc(100vh - 311px)', 
        overflowY: 'auto',
        width: '100%',
        maxWidth: '100%',
        boxSizing: 'border-box'
      }}>
        {!suppressApi && currentPageItems.map(model => (
          <article
            key={model.id}
            aria-label={`Meta model: ${model.name}`}
            style={fileCardStyle}
            onMouseEnter={(e) => Object.assign(e.currentTarget.style, fileCardHoverStyle)}
            onMouseLeave={(e) => Object.assign(e.currentTarget.style, fileCardStyle)}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
                <div style={{ 
                  fontWeight: 700, 
                  color: '#1f2937', 
                  fontSize: 16,
                  fontFamily: 'Georgia, serif',
                }}>
                  {model.name}
                </div>
                {model.domain && (
                  <div style={{ 
                    fontSize: 12, 
                    color: '#6b7280',
                    fontWeight: 500,
                  }}>
                    Domain: <span style={{ color: '#049484', fontWeight: 600 }}>{model.domain}</span>
                  </div>
                )}
                <div style={{ 
                  fontSize: 12, 
                  color: '#9ca3af',
                }}>
                  Created: {(() => {
                    const d = new Date(model.createdAt);
                    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                  })()}
                </div>
              </div>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setViewModel(model);
                }}
                style={{
                  padding: '8px 16px',
                  border: '1px solid #049484',
                  borderRadius: 8,
                  background: '#ffffff',
                  cursor: 'pointer',
                  fontWeight: 600,
                  fontSize: 13,
                  color: '#049484',
                  transition: 'all 0.2s ease',
                  whiteSpace: 'nowrap',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = '#049484';
                  e.currentTarget.style.color = '#ffffff';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = '#ffffff';
                  e.currentTarget.style.color = '#049484';
                }}
              >
                View Details
              </button>
            </div>
          </article>
        ))}
        {!suppressApi && !isLoadingModels && sortedModels.length === 0 && !apiError && (
          <div style={emptyStateStyle}>
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" strokeWidth="1.5">
              <path d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
            </svg>
            <div style={{ fontWeight: 600, fontSize: 16, color: '#374151' }}>
              No Meta Models Found
            </div>
            <div style={{ fontSize: 13, color: '#9ca3af', maxWidth: 280 }}>
              {showAllModels 
                ? "No models exist yet. Import your first meta model to get started."
                : "You haven't created any models yet. Try switching to 'All Models' or import a new one."}
            </div>
          </div>
        )}
      </div>
      )}

      {viewModel && ReactDOM.createPortal(
          <dialog
              open
              style={{
                ...modalDialogShellStyle,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
          >
            <button
              type="button"
              aria-label="Close meta model details"
              style={{ ...modalBackdropStyle, position: 'absolute' }}
              onClick={() => {
                resetMetaModelModalState();
              }}
            />
            <div
                style={{
                  position: 'relative',
                  zIndex: 1,
                  width: 'min(800px, 92vw)',
                  height: 'min(640px, 88vh)',
                  background: '#ffffff',
                  borderRadius: 10,
                  boxShadow: '0 24px 64px rgba(0,0,0,0.22), 0 4px 16px rgba(0,0,0,0.10)',
                  overflow: 'hidden',
                  display: 'flex',
                  flexDirection: 'column',
                  fontFamily: 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
                  border: '1px solid #e2e8f0',
                }}
            >
              {/* ── Header ── */}
              <div style={{ padding: '14px 20px', background: '#ffffff', borderBottom: '1px solid #f1f5f9', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, overflow: 'hidden' }}>
                  <svg width="28" height="28" viewBox="0 0 32 32" fill="none" style={{ flexShrink: 0 }}>
                    <path d="M16 5L27 11V21L16 27L5 21V11L16 5Z" stroke="#049484" strokeWidth="1.6" fill="#04948422" strokeLinejoin="round" />
                    <path d="M16 5V27" stroke="#049484" strokeWidth="1.3" strokeLinecap="round" />
                    <path d="M5 11L27 11" stroke="#049484" strokeWidth="1.3" strokeLinecap="round" />
                    <path d="M16 5L5 11L16 17L27 11L16 5Z" stroke="#049484" strokeWidth="1.3" fill="#04948418" strokeLinejoin="round" />
                  </svg>
                  <div style={{ fontSize: 16, fontWeight: 700, color: '#0f172a', letterSpacing: '-0.01em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    Modell-Vorschau: <span style={{ color: '#374151', fontWeight: 600 }}>{viewModel.name}</span>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                  {metaModelModalTab === 'details' && (
                    <button
                      onClick={() => { setMetaModelModalTab('edit'); setEditError(''); setEditSuccess(''); }}
                      style={{ height: 30, padding: '0 12px', border: '1px solid #e2e8f0', borderRadius: 7, background: '#f8fafc', color: '#374151', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, transition: 'all 0.12s' }}
                      onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = '#0B1720'; (e.currentTarget as HTMLButtonElement).style.color = '#fff'; (e.currentTarget as HTMLButtonElement).style.borderColor = '#0B1720'; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = '#f8fafc'; (e.currentTarget as HTMLButtonElement).style.color = '#374151'; (e.currentTarget as HTMLButtonElement).style.borderColor = '#e2e8f0'; }}
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                      </svg>
                      Edit
                    </button>
                  )}
                  <button
                    onClick={() => resetMetaModelModalState()}
                    style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#94a3b8', fontSize: 16, width: 30, height: 30, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.1s' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = '#f1f5f9'; (e.currentTarget as HTMLButtonElement).style.color = '#374151'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; (e.currentTarget as HTMLButtonElement).style.color = '#94a3b8'; }}
                  >✕</button>
                </div>
              </div>

              {/* ── Two-column body ── */}
              <style>{`@keyframes tpspin{0%{transform:rotate(0deg)}100%{transform:rotate(360deg)}}`}</style>
              <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

                {/* Left — fields */}
                <div style={{ width: 280, flexShrink: 0, borderRight: '1px solid #f1f5f9', overflowY: 'auto', padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 20 }}>
                  {metaModelModalTab === 'edit' ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, flex: 1 }}>
                      {editError && <div style={{ padding: '8px 12px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, fontSize: 12, color: '#dc2626' }}>{editError}</div>}
                      {editSuccess && <div style={{ padding: '8px 12px', background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 8, fontSize: 12, color: '#15803d' }}>{editSuccess}</div>}
                      <div>
                        <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#374151', marginBottom: 5 }}>Name</label>
                        <input value={editFormData.name} onChange={e => setEditFormData({ ...editFormData, name: e.target.value })}
                          style={{ width: '100%', padding: '9px 12px', border: '1.5px solid #e2e8f0', borderRadius: 8, fontSize: 13, color: '#0f172a', background: '#f8fafc', boxSizing: 'border-box', outline: 'none' }}
                          onFocus={e => (e.currentTarget.style.borderColor = '#049484')} onBlur={e => (e.currentTarget.style.borderColor = '#e2e8f0')} />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#374151', marginBottom: 5 }}>Description</label>
                        <textarea value={editFormData.description} onChange={e => setEditFormData({ ...editFormData, description: e.target.value })} rows={3}
                          style={{ width: '100%', padding: '9px 12px', border: '1.5px solid #e2e8f0', borderRadius: 8, fontSize: 13, color: '#0f172a', background: '#f8fafc', boxSizing: 'border-box', outline: 'none', resize: 'vertical', minHeight: 72 }}
                          onFocus={e => (e.currentTarget.style.borderColor = '#049484')} onBlur={e => (e.currentTarget.style.borderColor = '#e2e8f0')} />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#374151', marginBottom: 5 }}>Domain</label>
                        <input value={editFormData.domain} onChange={e => setEditFormData({ ...editFormData, domain: e.target.value })}
                          style={{ width: '100%', padding: '9px 12px', border: '1.5px solid #e2e8f0', borderRadius: 8, fontSize: 13, color: '#0f172a', background: '#f8fafc', boxSizing: 'border-box', outline: 'none' }}
                          onFocus={e => (e.currentTarget.style.borderColor = '#049484')} onBlur={e => (e.currentTarget.style.borderColor = '#e2e8f0')} />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#374151', marginBottom: 5 }}>Keywords</label>
                        <KeywordTagsInput keywords={editFormData.keywords} onChange={keywords => setEditFormData({ ...editFormData, keywords })} />
                      </div>
                      <div style={{ marginTop: 'auto', paddingTop: 8, display: 'flex', gap: 8 }}>
                        <button type="button" onClick={() => setMetaModelModalTab('details')}
                          style={{ flex: 1, padding: '8px 0', border: '1px solid #e2e8f0', borderRadius: 8, background: '#fff', color: '#374151', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                          onMouseEnter={e => (e.currentTarget.style.background = '#f8fafc')} onMouseLeave={e => (e.currentTarget.style.background = '#fff')}>
                          Cancel
                        </button>
                        <button type="button" disabled={isEditSubmitDisabled} onClick={handleEditSubmit as any}
                          style={{ flex: 1, padding: '8px 0', background: isEditSubmitDisabled ? '#94a3b8' : '#0B1720', color: '#fff', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: isEditSubmitDisabled ? 'not-allowed' : 'pointer' }}
                          onMouseEnter={e => { if (!isEditSubmitDisabled) (e.currentTarget as HTMLButtonElement).style.background = '#1e293b'; }}
                          onMouseLeave={e => { if (!isEditSubmitDisabled) (e.currentTarget as HTMLButtonElement).style.background = '#0B1720'; }}>
                          {isEditLoading ? 'Saving…' : 'Save'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 700, color: '#374151', marginBottom: 5, letterSpacing: '0.01em' }}>Name</div>
                        <div style={{ fontSize: 14, fontWeight: 600, color: '#0f172a', lineHeight: 1.4 }}>{viewModel.name}</div>
                      </div>
                      {viewModel.keyword?.length > 0 && (
                        <div>
                          <div style={{ fontSize: 11, fontWeight: 700, color: '#374151', marginBottom: 5, letterSpacing: '0.01em' }}>Keywords</div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                            {viewModel.keyword.map((kw: string) => (
                              <span key={kw} style={{ padding: '3px 10px', borderRadius: 20, background: '#e0e7ff', color: '#4338ca', fontSize: 11, fontWeight: 600 }}>{kw}</span>
                            ))}
                          </div>
                        </div>
                      )}
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: '#374151', marginBottom: 5, letterSpacing: '0.01em' }}>Beschreibung</div>
                        <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.7 }}>
                          {viewModel.description || <span style={{ color: '#cbd5e1' }}>—</span>}
                        </div>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 'auto', paddingTop: 8, borderTop: '1px solid #f1f5f9' }}>
                        <MetaModelFileDownloads
                          modelName={viewModel.name}
                          ecoreFileId={viewModel.ecoreFileId}
                          genModelFileId={viewModel.genModelFileId}
                        />
                        {viewModel.createdAt && (
                          <div>
                            <div style={{ fontSize: 11, fontWeight: 700, color: '#374151', marginBottom: 5, letterSpacing: '0.01em' }}>Created</div>
                            <div style={{ fontSize: 13, color: '#64748b' }}>{new Date(viewModel.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })}</div>
                          </div>
                        )}
                        {viewModel.updatedAt && (
                          <div>
                            <div style={{ fontSize: 11, fontWeight: 700, color: '#374151', marginBottom: 5, letterSpacing: '0.01em' }}>Updated</div>
                            <div style={{ fontSize: 13, color: '#64748b' }}>{new Date(viewModel.updatedAt).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })}</div>
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>

                {/* Right — UML preview */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#ffffff' }}>
                  <div style={{ padding: '14px 18px 10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>UML-Preview</span>
                    {umlContent && (
                      <div style={{ display: 'flex', gap: 4 }}>
                        {[
                          { title: 'Zoom in', icon: <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>, fn: () => diagramRef.current?.zoomIn() },
                          { title: 'Zoom out', icon: <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="5" y1="12" x2="19" y2="12"/></svg>, fn: () => diagramRef.current?.zoomOut() },
                          { title: 'Fit to view', icon: <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 3H5a2 2 0 0 0-2 2v3"/><path d="M21 8V5a2 2 0 0 0-2-2h-3"/><path d="M3 16v3a2 2 0 0 0 2 2h3"/><path d="M16 21h3a2 2 0 0 0 2-2v-3"/></svg>, fn: () => diagramRef.current?.fitToView() },
                        ].map(({ title, icon, fn }) => (
                          <button key={title} title={title} onClick={fn}
                            style={{ width: 24, height: 24, border: '1px solid #e2e8f0', borderRadius: 6, background: '#fff', color: '#64748b', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = '#f1f5f9'; (e.currentTarget as HTMLButtonElement).style.color = '#0f172a'; }}
                            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = '#fff'; (e.currentTarget as HTMLButtonElement).style.color = '#64748b'; }}>
                            {icon}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <div style={{ flex: 1, padding: '0 18px 18px', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                    <div style={{ flex: 1, position: 'relative', background: '#ffffff', borderRadius: 10, border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
                      {umlFetching && (
                        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, color: '#94a3b8' }}>
                          <div style={{ width: 24, height: 24, border: '2.5px solid #e2e8f0', borderTop: '2.5px solid #049484', borderRadius: '50%', animation: 'tpspin 0.8s linear infinite' }} />
                          <span style={{ fontSize: 12 }}>Loading preview…</span>
                        </div>
                      )}
                      {!umlFetching && umlError && (
                        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#cbd5e1', fontSize: 12 }}>Could not load UML preview</div>
                      )}
                      {!umlFetching && !umlError && !umlContent && (
                        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#cbd5e1', fontSize: 12 }}>No diagram available</div>
                      )}
                      {umlContent && viewModel && (
                        <UMLDiagram
                          ref={diagramRef}
                          ecoreContent={umlContent}
                          fileName={metaModelPreviewLayoutFileName(viewModel.id, viewModel.name)}
                          layoutScopeId={METAMODEL_PREVIEW_LAYOUT_SCOPE}
                        />
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </dialog>,
      document.body)}

      {/* Meta Model Delete Confirmation */}
      {metaModelDeleteConfirmOpen && viewModel && ReactDOM.createPortal(
          <dialog
              open
              style={{
                ...modalDialogShellStyle,
                zIndex: MODAL_Z_INDEX + 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
          >
            <button
              type="button"
              aria-label="Close delete confirmation"
              style={{ ...modalBackdropStyle, position: 'absolute' }}
              onClick={() => { if (!metaModelDeleting) setMetaModelDeleteConfirmOpen(false); }}
              disabled={metaModelDeleting}
            />
            <div
                style={{
                  position: 'relative',
                  zIndex: 1,
                  width: 500,
                  maxWidth: '90vw',
                  background: '#fff',
                  borderRadius: 12,
                  boxShadow: '0 20px 60px rgba(220, 38, 38, 0.15), 0 10px 30px rgba(0, 0, 0, 0.1)',
                  overflow: 'hidden',
                  fontFamily: 'Georgia, serif',
                  border: '1px solid #fee2e2',
                }}
            >
              <div style={{ 
                padding: '20px 24px', 
                borderBottom: '2px solid #dc2626',
                background: 'linear-gradient(135deg, #fff5f5 0%, #fef2f2 100%)'
              }}>
                <h2 id="delete-dialog-title" style={{ 
                  fontWeight: 700, 
                  color: '#2c3e50', 
                  margin: 0, 
                  fontSize: 20,
                  fontFamily: 'Georgia, serif',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  letterSpacing: '0.01em'
                }}>
                  <span style={{ fontSize: 24 }}>⚠️</span>
                  {' '}
                  Confirm Deletion
                </h2>
              </div>

              <div style={{ 
                padding: '24px', 
                color: '#374151', 
                fontSize: 15,
                lineHeight: 1.6,
                fontFamily: 'Georgia, serif'
              }}>
                <p style={{ margin: '0 0 16px 0' }}>
                  Are you sure you want to permanently delete <strong style={{ color: '#dc2626' }}>"{viewModel.name}"</strong> from your workspace?
                </p>
                <div style={{
                  padding: '16px',
                  background: '#fff8ed',
                  borderLeft: '4px solid #f59e0b',
                  borderRadius: 6,
                  fontSize: 14,
                  color: '#92400e',
                  lineHeight: 1.7
                }}>
                  <strong style={{ display: 'block', marginBottom: 8, color: '#b45309' }}>⚠️ Warning:</strong>
                  <ul style={{ margin: 0, paddingLeft: 20 }}>
                    <li style={{ marginBottom: 6 }}>All reactions related to this meta model will be permanently deleted</li>
                    <li>Any edits and changes made to this meta model will be lost</li>
                  </ul>
                  <p style={{ margin: '12px 0 0 0', fontStyle: 'italic', fontSize: 13 }}>
                    This action cannot be undone.
                  </p>
                </div>
                {metaModelDeleteError && (
                    <div
                        style={{
                          marginTop: 16,
                          padding: 14,
                          border: '2px solid #fca5a5',
                          background: 'linear-gradient(135deg, #fff5f5 0%, #fee 100%)',
                          color: '#991b1b',
                          borderRadius: 8,
                          fontSize: 14,
                          boxShadow: '0 2px 8px rgba(220, 38, 38, 0.1)',
                        }}
                    >
                      {metaModelDeleteError}
                    </div>
                )}
              </div>

              <div style={{ 
                padding: '16px 24px', 
                borderTop: '1px solid #e9ecef',
                display: 'flex', 
                justifyContent: 'flex-end', 
                gap: 12,
                background: '#f8f9fa'
              }}>
                <button
                    onClick={() => {
                      setMetaModelDeleteConfirmOpen(false);
                      setMetaModelDeleteError('');
                    }}
                    disabled={metaModelDeleting}
                    style={{
                      padding: '10px 20px',
                      borderRadius: 8,
                      border: '1px solid #dee2e6',
                      background: '#fff',
                      color: '#495057',
                      fontWeight: 600,
                      cursor: metaModelDeleting ? 'not-allowed' : 'pointer',
                      fontSize: 14,
                      fontFamily: 'Georgia, serif',
                      transition: 'all 0.2s ease',
                    }}
                    onMouseEnter={(e) => {
                      if (!metaModelDeleting) {
                        e.currentTarget.style.background = '#f8f9fa';
                        e.currentTarget.style.borderColor = '#adb5bd';
                      }
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = '#fff';
                      e.currentTarget.style.borderColor = '#dee2e6';
                    }}
                >
                  Cancel
                </button>

                <button
                    onClick={async () => {
                      if (!viewModel?.id) return;
                      setMetaModelDeleteError('');
                      setMetaModelDeleting(true);
                      try {
                        await apiService.deleteMetaModel(viewModel.id);
                        setMetaModelDeleteConfirmOpen(false);
                        setViewModel(null);
                        setUploadMessage('Meta Model deleted successfully!');
                        setUploadMessageType('success');
                        const filters = buildApiFiltersFromParsedFilters(parsedFilters, true);
                        const response = await apiService.findMetaModels(filters);
                        setApiModels(response.data || []);
                        setTimeout(() => setUploadMessage(''), 3000);
                      } catch (error: any) {
                        let msg = 'Failed to delete meta model';
                        if (error?.response?.data?.message) {
                          msg = error.response.data.message;
                        } else if (error?.message) {
                          msg = error.message;
                        }
                        setMetaModelDeleteError(msg);
                      } finally {
                        setMetaModelDeleting(false);
                      }
                    }}
                    disabled={metaModelDeleting}
                    style={{
                      padding: '10px 24px',
                      borderRadius: 8,
                      border: 'none',
                      background: metaModelDeleting ? '#fca5a5' : 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)',
                      color: '#fff',
                      fontWeight: 600,
                      cursor: metaModelDeleting ? 'not-allowed' : 'pointer',
                      fontSize: 14,
                      fontFamily: 'Georgia, serif',
                      transition: 'all 0.2s ease',
                      boxShadow: metaModelDeleting ? 'none' : '0 4px 12px rgba(220, 38, 38, 0.3)',
                    }}
                    onMouseEnter={(e) => {
                      if (!metaModelDeleting) {
                        e.currentTarget.style.transform = 'translateY(-1px)';
                        e.currentTarget.style.boxShadow = '0 6px 16px rgba(220, 38, 38, 0.4)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.boxShadow = metaModelDeleting ? 'none' : '0 4px 12px rgba(220, 38, 38, 0.3)';
                    }}
                >
                  {metaModelDeleting ? 'Deleting…' : 'Delete Permanently'}
                </button>
              </div>
            </div>
          </dialog>,
      document.body)}

      {!suppressApi && totalPages > 1 && (
        <div style={paginationContainerStyle}>
          <div style={paginationInfoStyle}>
            Showing {startIndex + 1}-{Math.min(endIndex, totalItems)} of {totalItems} models
          </div>
          <div style={paginationControlsStyle}>
            <button
              style={{
                ...paginationButtonStyle,
                ...(currentPage === 1 ? paginationButtonDisabledStyle : {})
              }}
              onClick={goToPreviousPage}
              disabled={currentPage === 1}
              onMouseEnter={(e) => {
                if (currentPage > 1) {
                  Object.assign(e.currentTarget.style, paginationButtonHoverStyle);
                }
              }}
              onMouseLeave={(e) => {
                if (currentPage > 1) {
                  Object.assign(e.currentTarget.style, paginationButtonStyle);
                }
              }}
            >
              ‹
            </button>
            
            {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => {
              const shouldShow = 
                page === 1 || 
                page === totalPages || 
                Math.abs(page - currentPage) <= 1;
              
              if (!shouldShow) {
                if (page === 2 && currentPage > 4) {
                  return <span key={`ellipsis-${page}`} style={{ padding: '0 4px', color: '#6c757d' }}>...</span>;
                }
                if (page === totalPages - 1 && currentPage < totalPages - 3) {
                  return <span key={`ellipsis-${page}`} style={{ padding: '0 4px', color: '#6c757d' }}>...</span>;
                }
                return null;
              }
              
              return (
                <button
                  key={page}
                  style={{
                    ...paginationButtonStyle,
                    ...(page === currentPage ? paginationButtonActiveStyle : {})
                  }}
                  onClick={() => goToPage(page)}
                  onMouseEnter={(e) => {
                    if (page !== currentPage) {
                      Object.assign(e.currentTarget.style, paginationButtonHoverStyle);
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (page !== currentPage) {
                      Object.assign(e.currentTarget.style, paginationButtonStyle);
                    }
                  }}
                >
                  {page}
                </button>
              );
            })}
            
            <button
              style={{
                ...paginationButtonStyle,
                ...(currentPage === totalPages ? paginationButtonDisabledStyle : {})
              }}
              onClick={goToNextPage}
              disabled={currentPage === totalPages}
              onMouseEnter={(e) => {
                if (currentPage < totalPages) {
                  Object.assign(e.currentTarget.style, paginationButtonHoverStyle);
                }
              }}
              onMouseLeave={(e) => {
                if (currentPage < totalPages) {
                  Object.assign(e.currentTarget.style, paginationButtonStyle);
                }
              }}
            >
              ›
            </button>
          </div>
        </div>
      )}
      
      <CreateModelModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSuccess={(modelData) => {
          setUploadMessage('Meta Model created successfully!');
          setUploadMessageType('success');
          setTimeout(() => setUploadMessage(''), 3000);
          const fetchData = async () => {
            setIsLoadingModels(true);
            setApiError('');
            try {
              const filters = buildApiFiltersFromParsedFilters(parsedFilters, true);
              const response = await apiService.findMetaModels(filters);
              setApiModels(response.data || []);
            } catch (error) {
              setApiError(error instanceof Error ? error.message : 'Failed to fetch meta models');
            } finally {
              setIsLoadingModels(false);
            }
          };
          fetchData();
        }}
      />

      {deleteConfirmOpen && ReactDOM.createPortal(
        <>
          <button
            type="button"
            aria-hidden="true"
            tabIndex={-1}
            onClick={() => { setDeleteConfirmOpen(false); setDeletingId(null); setDeleteError(''); }}
            style={{ ...modalBackdropStyle, zIndex: MODAL_Z_INDEX }}
          />
          <div style={{
            position: 'fixed',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: MODAL_Z_INDEX + 1,
            pointerEvents: 'none',
          }}>
          <div style={{
            pointerEvents: 'auto',
            background: '#fff',
            borderRadius: 10,
            boxShadow: '0 10px 40px rgba(0,0,0,0.25)',
            padding: '28px 24px',
            minWidth: 420,
            maxWidth: '90vw',
            fontFamily: 'Georgia, serif'
          }}>
            <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 12, color: '#dc2626', display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 24 }}>⚠️</span>
              {' '}
              Are you sure?
            </div>
            <div style={{ fontSize: 14, color: '#4b5563', marginBottom: 20, lineHeight: 1.6 }}>
              Are you sure you want to delete this meta model from your workspace?
            </div>
            <div style={{
              padding: '16px',
              background: '#fff8ed',
              borderLeft: '4px solid #f59e0b',
              borderRadius: 6,
              fontSize: 13,
              color: '#92400e',
              lineHeight: 1.7,
              marginBottom: 20
            }}>
              <strong style={{ display: 'block', marginBottom: 8, color: '#b45309' }}>⚠️ Warning:</strong>
              <ul style={{ margin: 0, paddingLeft: 20 }}>
                <li style={{ marginBottom: 6 }}>All reactions related to this meta model will be permanently deleted</li>
                <li>Any edits and changes made to this meta model will be lost</li>
              </ul>
              <p style={{ margin: '12px 0 0 0', fontStyle: 'italic', fontSize: 12 }}>
                This action cannot be undone.
              </p>
            </div>
            {deleteError && (
              <div style={{
                color: '#991b1b',
                background: '#fee2e2',
                border: '1px solid #fca5a5',
                borderRadius: 6,
                padding: '10px 12px',
                marginBottom: '16px',
                fontSize: 13,
                fontWeight: 500,
              }}>
                {deleteError}
              </div>
            )}
            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
              <button
                style={{
                  padding: '10px 20px',
                  borderRadius: 6,
                  border: '1px solid #dee2e6',
                  background: '#fff',
                  color: '#495057',
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontSize: 14
                }}
                onClick={() => { setDeleteConfirmOpen(false); setDeletingId(null); setDeleteError(''); }}
              >
                Cancel
              </button>
              <button
                style={{
                  padding: '10px 20px',
                  borderRadius: 6,
                  border: 'none',
                  background: '#dc2626',
                  color: '#fff',
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontSize: 14
                }}
                onClick={handleConfirmDelete}
              >
                Delete Permanently
              </button>
            </div>
          </div>
          </div>
        </>,
      document.body)}

    </div>
  );
  };

  const renderMainPanelContentLayout = () => renderMainPanelContentMarkup();

  const renderMainPanelContentBody = () => renderMainPanelContentLayout();

  const renderMainPanelContent = () => renderMainPanelContentBody();

  const renderMainPanel = () => renderMainPanelContent();

  const renderToolsPanelContent = () => renderMainPanel();

  return renderToolsPanelContent();
};