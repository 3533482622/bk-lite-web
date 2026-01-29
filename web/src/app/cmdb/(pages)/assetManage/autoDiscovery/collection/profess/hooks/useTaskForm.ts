import { useState, useEffect } from 'react';
import { Form, message } from 'antd';
import { useTranslation } from '@/utils/i18n';
import { useCollectApi } from '@/app/cmdb/api';
import { CYCLE_OPTIONS, PASSWORD_PLACEHOLDER } from '@/app/cmdb/constants/professCollection';
import dayjs from 'dayjs';
import { useAssetManageStore } from '@/app/cmdb/store';

interface UseTaskFormProps {
  modelId: string;
  editId?: number | null;
  onSuccess?: () => void;
  onClose: () => void;
  formatValues: (values: any) => any;
  initialValues: Record<string, any>;
}

export const useTaskForm = ({
  editId,
  onSuccess,
  onClose,
  formatValues,
}: UseTaskFormProps) => {
  const { t } = useTranslation();
  const collectApi = useCollectApi();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [submitLoading, setSubmitLoading] = useState(false);
  const { copyTaskData, setCopyTaskData } = useAssetManageStore();

  const initFormFromCopyData = (copyData: any) => {
    // Exclude system fields
    const systemFields = ['id', 'created_at', 'updated_at', 'created_by', 'exec_status', 'exec_time', 'message'];
    const filteredData = Object.keys(copyData).reduce((acc, key) => {
      if (!systemFields.includes(key)) {
        acc[key] = copyData[key];
      }
      return acc;
    }, {} as any);

    // Add suffix to task name
    const taskName = filteredData.name ? `${filteredData.name} - 副本` : '';
    
    // Handle cycle field conversion
    const cycleType = filteredData.cycle_value_type || CYCLE_OPTIONS.ONCE;
    const cycleValue = filteredData.cycle_value;
    
    // Spread all credential fields to handle all task types (SNMP, VM, Cloud, etc.)
    const credentialFields = filteredData.credential || {};
    
    // Set form values with all fields
    form.setFieldsValue({
      ...filteredData,
      taskName,
      instId: filteredData.instances?.[0]?._id,
      cycle: cycleType,
      accessPointId: filteredData.access_point?.[0]?.id,
      organization: filteredData.team || [],
      ipRange: filteredData.ip_range?.split('-') || [],
      // Spread all credential fields
      ...credentialFields,
      // Replace sensitive values with placeholder
      ...(credentialFields.password && { password: PASSWORD_PLACEHOLDER }),
      ...(credentialFields.community && { community: PASSWORD_PLACEHOLDER }),
      ...(credentialFields.authkey && { authkey: PASSWORD_PLACEHOLDER }),
      ...(credentialFields.privkey && { privkey: PASSWORD_PLACEHOLDER }),
      ...(credentialFields.accessKey && { accessKey: PASSWORD_PLACEHOLDER }),
      ...(credentialFields.accessSecret && { accessSecret: PASSWORD_PLACEHOLDER }),
      // Cycle fields
      ...(cycleType === CYCLE_OPTIONS.DAILY && {
        dailyTime: dayjs(cycleValue, 'HH:mm'),
      }),
      ...(cycleType === CYCLE_OPTIONS.INTERVAL && {
        intervalValue: Number(cycleValue),
        everyHours: Number(cycleValue),
      }),
      // Advanced timeout field
      timeout: filteredData.timeout || 600,
    });

    // Clear copyTaskData after use
    setCopyTaskData(null);
  };

  const formatCycleValue = (values: any) => {
    const { cycle } = values;
    if (cycle === CYCLE_OPTIONS.ONCE) {
      return { value_type: 'close', value: '' };
    } else if (cycle === CYCLE_OPTIONS.INTERVAL) {
      return {
        value_type: 'cycle',
        value: values.intervalValue || values.everyHours,
      };
    } else if (cycle === CYCLE_OPTIONS.DAILY) {
      return {
        value_type: 'timing',
        value: values.dailyTime?.format('HH:mm') || '',
      };
    }
    return { value_type: 'close', value: '' };
  };

  const fetchTaskDetail = async (id: number) => {
    try {
      setLoading(true);
      const data = await collectApi.getCollectDetail(id.toString());
      // console.log('test2.5:getCollectDetail', data.cycle_value_type);
      useAssetManageStore.getState().setScanCycleType(data.cycle_value_type || null);
      const cycleType = data.cycle_value_type || CYCLE_OPTIONS.ONCE;
      const cycleValue = data.cycle_value;
      form.setFieldsValue({
        ...data,
        taskName: data.name,
        instId: data.instances?.[0]?._id,
        cycle: cycleType,
        ...(cycleType === CYCLE_OPTIONS.DAILY && {
          dailyTime: dayjs(cycleValue, 'HH:mm'),
        }),
        ...(cycleType === CYCLE_OPTIONS.INTERVAL && {
          intervalValue: Number(cycleValue),
          everyHours: Number(cycleValue),
        }),
      });
      return data;
    } catch (error) {
      console.error('Failed to fetch task detail:', error);
    } finally {
      setLoading(false);
    }
  };

  const onFinish = async (values: any) => {
    try {
      setSubmitLoading(true);
      const params = formatValues(values);
      if (editId) {
        // console.log('test2.3', params.scan_cycle.value_type);
        if (params.scan_cycle.value_type === "cycle") {
          await collectApi.updateCollect(editId.toString(), params);
          message.success(t('successfullyModified'));
        }else{
          message.error(t('Collection.cycleDeprecated'));
          return;
        }
      } else {
        await collectApi.createCollect(params);
        message.success(t('successfullyAdded'));
      }

      onSuccess?.();
      onClose();
    } catch (error) {
      console.error('Failed to save task:', error);
    } finally {
      setSubmitLoading(false);
    }
  };

  // Handle copyTaskData initialization
  useEffect(() => {
    if (!editId && copyTaskData) {
      initFormFromCopyData(copyTaskData);
    }
  }, [copyTaskData, editId]);

  return {
    form,
    loading,
    submitLoading,
    fetchTaskDetail,
    onFinish,
    formatCycleValue,
    initFormFromCopyData,
  };
};
