import * as React from 'react';
import {
  DrawerActions,
  DrawerCloseButton,
  DrawerHead,
  DrawerPanelContent,
  DrawerPanelBody,
  Badge,
  Flex,
  FlexItem,
  Icon,
  Title,
  ToggleGroup,
  ToggleGroupItem,
  Tooltip,
} from '@patternfly/react-core';
import { ExclamationTriangleIcon } from '@patternfly/react-icons';
import {
  useChatbotConfigStore,
  selectSystemInstruction,
  selectTemperature,
  selectStreamingEnabled,
  selectSelectedMcpServerIds,
  selectSelectedModel,
  selectSelectedSubscription,
  selectRagEnabled,
  selectConfigIds,
  DEFAULT_CONFIG_ID,
} from '~/app/Chatbot/store';
import { UseSourceManagementReturn } from '~/app/Chatbot/hooks/useSourceManagement';
import { UseFileManagementReturn } from '~/app/Chatbot/hooks/useFileManagement';
import useGuardrailsEnabled from '~/app/Chatbot/hooks/useGuardrailsEnabled';
import { MCPServerFromAPI, TokenInfo } from '~/app/types';
import { ServerStatusInfo } from '~/app/hooks/useMCPServerStatuses';
import {
  ModelTabContent,
  PromptTabContent,
  KnowledgeTabContent,
  MCPTabContent,
  GuardrailsTabContent,
} from './settingsPanelTabs';

interface ChatbotSettingsPanelProps {
  configId?: string;
  alerts: {
    uploadSuccessAlert: React.ReactElement | undefined;
    deleteSuccessAlert: React.ReactElement | undefined;
    errorAlert: React.ReactElement | undefined;
  };
  sourceManagement: UseSourceManagementReturn;
  fileManagement: UseFileManagementReturn;
  initialServerStatuses?: Map<string, ServerStatusInfo>;
  mcpServers: MCPServerFromAPI[];
  mcpServersLoaded: boolean;
  mcpServersLoadError?: Error | null;
  mcpServerTokens: Map<string, TokenInfo>;
  onMcpServerTokensChange: (tokens: Map<string, TokenInfo>) => void;
  checkMcpServerStatus: (serverUrl: string, mcpBearerToken?: string) => Promise<ServerStatusInfo>;
  // Guardrails props
  guardrailModels?: string[];
  guardrailModelsLoaded?: boolean;
  onCloseClick?: () => void;
  onActiveConfigChange?: (configId: string) => void;
  guardrailModelsError?: Error;
  /** Whether the drawer is in overlay mode (compare mode) - affects background styling */
  isOverlay?: boolean;
  defaultActiveTabKey?: number;
}

const SETTINGS_PANEL_WIDTH = 'chatbot-settings-panel-width';
const DEFAULT_WIDTH = '550px';
const AUTO_CLOSE_WIDTH_THRESHOLD = 150;

const ChatbotSettingsPanel: React.FunctionComponent<ChatbotSettingsPanelProps> = ({
  configId = DEFAULT_CONFIG_ID,
  alerts,
  sourceManagement,
  fileManagement,
  initialServerStatuses,
  mcpServers,
  mcpServersLoaded,
  mcpServersLoadError,
  mcpServerTokens,
  onMcpServerTokensChange,
  checkMcpServerStatus,
  guardrailModels = [],
  guardrailModelsLoaded = false,
  onCloseClick,
  onActiveConfigChange,
  guardrailModelsError,
  isOverlay = false,
  defaultActiveTabKey,
}) => {
  const [showMcpToolsWarning, setShowMcpToolsWarning] = React.useState(false);
  const [activeToolsCount, setActiveToolsCount] = React.useState(0);
  const isGuardrailsFeatureEnabled = useGuardrailsEnabled();

  const configIds = useChatbotConfigStore(selectConfigIds);

  // Consume store directly using configId (controlled by parent)
  const systemInstruction = useChatbotConfigStore(selectSystemInstruction(configId));
  const temperature = useChatbotConfigStore(selectTemperature(configId));
  const selectedMcpServerIds = useChatbotConfigStore(selectSelectedMcpServerIds(configId));
  const isStreamingEnabled = useChatbotConfigStore(selectStreamingEnabled(configId));
  const selectedModel = useChatbotConfigStore(selectSelectedModel(configId));
  const selectedSubscription = useChatbotConfigStore(selectSelectedSubscription(configId));
  const isRagEnabled = useChatbotConfigStore(selectRagEnabled(configId));

  // Get updater functions from store
  const updateSystemInstruction = useChatbotConfigStore((state) => state.updateSystemInstruction);
  const updateTemperature = useChatbotConfigStore((state) => state.updateTemperature);
  const updateStreamingEnabled = useChatbotConfigStore((state) => state.updateStreamingEnabled);
  const updateSelectedModel = useChatbotConfigStore((state) => state.updateSelectedModel);
  const updateSelectedSubscription = useChatbotConfigStore(
    (state) => state.updateSelectedSubscription,
  );

  // Create callback handlers that include configId
  const handleSystemInstructionChange = React.useCallback(
    (value: string) => {
      updateSystemInstruction(configId, value);
    },
    [configId, updateSystemInstruction],
  );

  const handleTemperatureChange = React.useCallback(
    (value: number) => {
      updateTemperature(configId, value);
    },
    [configId, updateTemperature],
  );

  const handleStreamingToggle = React.useCallback(
    (enabled: boolean) => {
      updateStreamingEnabled(configId, enabled);
    },
    [configId, updateStreamingEnabled],
  );

  const handleModelChange = React.useCallback(
    (model: string) => {
      updateSelectedModel(configId, model);
    },
    [configId, updateSelectedModel],
  );

  const handleSubscriptionChange = React.useCallback(
    (subscription: string) => {
      updateSelectedSubscription(configId, subscription);
    },
    [configId, updateSelectedSubscription],
  );

  // Panel width state with session storage persistence
  const [panelWidth, setPanelWidth] = React.useState<string>(() => {
    const storedWidth = sessionStorage.getItem(SETTINGS_PANEL_WIDTH);
    return storedWidth || DEFAULT_WIDTH;
  });

  // Key to force DrawerPanelContent remount when auto-closing, so it resets to defaultSize
  const [panelSizeKey, setPanelSizeKey] = React.useState(0);

  const handlePanelResize = (
    _event: MouseEvent | TouchEvent | React.KeyboardEvent<Element>,
    width: number,
  ) => {
    if (width < AUTO_CLOSE_WIDTH_THRESHOLD) {
      setPanelWidth(DEFAULT_WIDTH);
      sessionStorage.setItem(SETTINGS_PANEL_WIDTH, DEFAULT_WIDTH);
      setPanelSizeKey((k) => k + 1);
      onCloseClick?.();
      return;
    }
    const newWidth = `${width}px`;
    setPanelWidth(newWidth);
    sessionStorage.setItem(SETTINGS_PANEL_WIDTH, newWidth);
  };

  // Active settings section
  const [activeTabKey, setActiveTabKey] = React.useState<number>(defaultActiveTabKey ?? 0);

  // Overlay drawer (compare mode) needs explicit background color
  const panelStyle: React.CSSProperties | undefined = isOverlay
    ? {
        backgroundColor: 'var(--pf-t--global--background--color--primary--default)',
      }
    : undefined;

  return (
    <DrawerPanelContent
      key={panelSizeKey}
      isResizable
      defaultSize={panelWidth}
      minSize="300px"
      onResize={handlePanelResize}
      style={panelStyle}
    >
      <DrawerHead>
        {configIds.length === 1 ? (
          <Title headingLevel="h2" data-testid="chatbot-settings-panel-header">
            Configure
          </Title>
        ) : (
          <ToggleGroup
            aria-label="Chat configuration selector"
            data-testid="chatbot-config-switcher"
          >
            {configIds.map((id, index) => (
              <ToggleGroupItem
                key={id}
                text={`Chat ${index + 1}`}
                isSelected={id === configId}
                onChange={() => onActiveConfigChange?.(id)}
                data-testid={`chatbot-config-tab-${index + 1}`}
              />
            ))}
          </ToggleGroup>
        )}
        <DrawerActions>
          <DrawerCloseButton onClick={() => onCloseClick?.()} aria-label="Close settings panel" />
        </DrawerActions>
      </DrawerHead>
      <DrawerPanelBody>
        <ToggleGroup
          isFill
          aria-label="Chatbot settings page tabs"
          data-testid="chatbot-settings-page-tabs"
        >
          <ToggleGroupItem
            text="Model"
            isSelected={activeTabKey === 0}
            onChange={() => setActiveTabKey(0)}
            data-testid="chatbot-settings-page-tab-model"
          />
          <ToggleGroupItem
            text="Prompt"
            isSelected={activeTabKey === 1}
            onChange={() => setActiveTabKey(1)}
            data-testid="chatbot-settings-page-tab-prompt"
          />
          <ToggleGroupItem
            text={
              <Flex alignItems={{ default: 'alignItemsCenter' }} gap={{ default: 'gapSm' }}>
                <FlexItem>Knowledge</FlexItem>
                <FlexItem>
                  <Badge isRead={!isRagEnabled} data-testid="knowledge-status-badge">
                    {isRagEnabled ? 'On' : 'Off'}
                  </Badge>
                </FlexItem>
              </Flex>
            }
            isSelected={activeTabKey === 2}
            onChange={() => setActiveTabKey(2)}
            data-testid="chatbot-settings-page-tab-knowledge"
          />
          <ToggleGroupItem
            text={
              <Flex alignItems={{ default: 'alignItemsCenter' }} gap={{ default: 'gapSm' }}>
                <FlexItem>MCP</FlexItem>
                {selectedMcpServerIds.length > 0 && (
                  <FlexItem>
                    <Badge>{selectedMcpServerIds.length}</Badge>
                  </FlexItem>
                )}
                {showMcpToolsWarning && (
                  <FlexItem>
                    <Tooltip content="Performance may be degraded with more than 40 active tools">
                      <Icon status="warning" data-testid="mcp-tools-warning-icon">
                        <ExclamationTriangleIcon />
                      </Icon>
                    </Tooltip>
                  </FlexItem>
                )}
              </Flex>
            }
            isSelected={activeTabKey === 3}
            onChange={() => setActiveTabKey(3)}
            data-testid="chatbot-settings-page-tab-mcp"
          />
          {isGuardrailsFeatureEnabled && (
            <ToggleGroupItem
              text="Guardrails"
              isSelected={activeTabKey === 4}
              onChange={() => setActiveTabKey(4)}
              data-testid="chatbot-settings-page-tab-guardrails"
            />
          )}
        </ToggleGroup>

        {activeTabKey === 0 && (
          <ModelTabContent
            temperature={temperature}
            onTemperatureChange={handleTemperatureChange}
            isStreamingEnabled={isStreamingEnabled}
            onStreamingToggle={handleStreamingToggle}
            selectedModel={selectedModel}
            onModelChange={handleModelChange}
            selectedSubscription={selectedSubscription}
            onSubscriptionChange={handleSubscriptionChange}
          />
        )}
        {activeTabKey === 1 && (
          <PromptTabContent
            configId={configId}
            systemInstruction={systemInstruction}
            onSystemInstructionChange={handleSystemInstructionChange}
          />
        )}
        {activeTabKey === 2 && (
          <KnowledgeTabContent
            configId={configId}
            sourceManagement={sourceManagement}
            fileManagement={fileManagement}
            alerts={alerts}
          />
        )}
        {activeTabKey === 3 && (
          <MCPTabContent
            configId={configId}
            mcpServers={mcpServers}
            mcpServersLoaded={mcpServersLoaded}
            mcpServersLoadError={mcpServersLoadError}
            mcpServerTokens={mcpServerTokens}
            onMcpServerTokensChange={onMcpServerTokensChange}
            checkMcpServerStatus={checkMcpServerStatus}
            initialServerStatuses={initialServerStatuses}
            activeToolsCount={activeToolsCount}
            onActiveToolsCountChange={setActiveToolsCount}
            onToolsWarningChange={setShowMcpToolsWarning}
          />
        )}
        {activeTabKey === 4 && isGuardrailsFeatureEnabled && (
          <GuardrailsTabContent
            configId={configId}
            guardrailModels={guardrailModels}
            guardrailModelsLoaded={guardrailModelsLoaded}
            guardrailModelsError={guardrailModelsError}
          />
        )}
      </DrawerPanelBody>
    </DrawerPanelContent>
  );
};

export { ChatbotSettingsPanel };
