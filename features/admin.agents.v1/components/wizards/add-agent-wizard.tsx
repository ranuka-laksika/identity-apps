/**
 * Copyright (c) 2025, WSO2 LLC. (https://www.wso2.com).
 *
 * WSO2 LLC. licenses this file to you under the Apache License,
 * Version 2.0 (the "License"); you may not use this file except
 * in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied. See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

import { AuthenticatedUserInfo } from "@asgardeo/auth-react";
import { getInboundProtocolConfig } from "@wso2is/admin.applications.v1/api/application";
import { ModalWithSidePanel } from "@wso2is/admin.core.v1/components/modals/modal-with-side-panel";
import { AppState } from "@wso2is/admin.core.v1/store";
import { AlertLevels, IdentifiableComponentInterface } from "@wso2is/core/models";
import { addAlert } from "@wso2is/core/store";
import { URLUtils } from "@wso2is/core/utils";
import { CheckboxFieldAdapter, CheckboxGroupFieldAdapter, FinalForm, FinalFormField, FormRenderProps, TextFieldAdapter } from "@wso2is/form/src";
import { Button, CopyInputField, Heading, Hint } from "@wso2is/react-components";
import React, { FunctionComponent, ReactElement, useState } from "react";
import { Field } from "react-final-form";
import { useTranslation } from "react-i18next";
import { useDispatch, useSelector } from "react-redux";
import { Divider, Form, Grid, Icon, Message, Radio } from "semantic-ui-react";
import { addAgent } from "../../api/agents";
import { AgentScimSchema, AgentType } from "../../models/agents";

interface AddAgentWizardPropsInterface extends IdentifiableComponentInterface {
    isOpen: boolean;
    onClose: any;
}

interface FormValuesInterface {
    name?: string;
    description?: string;
    isUserServingAgent?: boolean;
    agentType?: AgentType;
    callbackUrl?: string;
    cibaAuthReqExpiryTime?: number;
    notificationChannels?: string[];
}

interface AgentCreationResultInterface {
    agentId?: string;
    agentSecret?: string;
    oauthClientId?: string;
    isUserServingAgent?: boolean;
}

const AddAgentWizard: FunctionComponent<AddAgentWizardPropsInterface> = (
    props: AddAgentWizardPropsInterface
): ReactElement => {
    const {
        isOpen,
        onClose,
        [ "data-componentid" ]: componentId
    } = props;

    const dispatch: any = useDispatch();
    const authenticatedUserInfo: AuthenticatedUserInfo = useSelector((state: AppState) => state?.auth);
    const { t } = useTranslation();

    const [ isSubmitting, setIsSubmitting ] = useState<boolean>(false);
    const [ creationResult, setCreationResult ] = useState<AgentCreationResultInterface | null>(null);
    const [ isShowingSuccessScreen, setIsShowingSuccessScreen ] = useState<boolean>(false);
    const [ submittedValues, setSubmittedValues ] = useState<FormValuesInterface | null>(null);

    const handleFormSubmit = async (values: FormValuesInterface): Promise<void> => {
        if (!values?.name) {
            return;
        }

        // Save the submitted values so the form can display them during loading
        setSubmittedValues(values);
        setIsSubmitting(true);

        const addAgentPayload: AgentScimSchema = {
            "urn:scim:wso2:agent:schema": {
                Description: values?.description,
                DisplayName: values?.name,
                IsUserServingAgent: values?.isUserServingAgent || false,
                AgentType: values?.agentType,
                CallbackUrl: values?.callbackUrl,
                CibaAuthReqExpiryTime: values?.cibaAuthReqExpiryTime,
                NotificationChannels: Array.isArray(values?.notificationChannels)
                    ? values.notificationChannels.join(",")
                    : values?.notificationChannels,
                Owner: authenticatedUserInfo?.username
            }
        };

        try {
            // Create the agent
            const response: AgentScimSchema = await addAgent(addAgentPayload);

            dispatch(
                addAlert({
                    description: "Agent created successfully",
                    level: AlertLevels.SUCCESS,
                    message: "Success"
                })
            );

            const result: AgentCreationResultInterface = {
                agentId: response?.userName,
                agentSecret: response?.password,
                oauthClientId: undefined,
                isUserServingAgent: values?.isUserServingAgent || false
            };

            // If this is a user-serving agent, fetch the OAuth Client ID before showing success screen
            if (values?.isUserServingAgent && response?.userName) {
                try {
                    // Extract the application ID from the agent username
                    // Agent username: AGENT/uuid → Application ID: uuid
                    const applicationId: string = response.userName.replace(/^AGENT\//i, "");

                    // Fetch the OIDC configuration for the application
                    const oidcConfig: any = await getInboundProtocolConfig(applicationId, "oidc");

                    if (oidcConfig?.clientId) {
                        result.oauthClientId = oidcConfig.clientId;
                    }
                } catch (error) {
                    // Continue showing the result even if client ID fetch fails
                    dispatch(
                        addAlert({
                            description: "Failed to fetch OAuth Client ID",
                            level: AlertLevels.WARNING,
                            message: "Client ID not available"
                        })
                    );
                }
            }

            // Show success screen with all data ready
            setCreationResult(result);
            setIsShowingSuccessScreen(true);
            setIsSubmitting(false);
        } catch (_err: unknown) {
            // On error, stay on form with the user's values
            setIsShowingSuccessScreen(false);
            setCreationResult(null);
            setSubmittedValues(null);
            dispatch(
                addAlert({
                    description: "Creating agent failed",
                    level: AlertLevels.ERROR,
                    message: "Something went wrong"
                })
            );
            setIsSubmitting(false);
        }
    };

    const handleClose = (): void => {
        setIsShowingSuccessScreen(false);
        setCreationResult(null);
        setSubmittedValues(null);
        onClose(creationResult);
    };

    const renderForm = (): ReactElement => {
        return (
            <FinalForm
                onSubmit={ handleFormSubmit }
                initialValues={ submittedValues || {
                    cibaAuthReqExpiryTime: 300,
                    notificationChannels: [ "email", "sms" ]
                } }
                render={ ({ handleSubmit, values }: FormRenderProps) => {
                    const isUserServingAgent: boolean = values?.isUserServingAgent === true;
                    const isSynchronous: boolean = values?.agentType === AgentType.SYNCHRONOUS;
                    const isAsynchronous: boolean = values?.agentType === AgentType.ASYNCHRONOUS;

                    return (
                        <>
                            <ModalWithSidePanel.MainPanel>
                                <ModalWithSidePanel.Header className="wizard-header">
                                    New Agent
                                    <Heading as="h6">
                                        Create a new AI agent with optional user authentication
                                    </Heading>
                                </ModalWithSidePanel.Header>
                                <ModalWithSidePanel.Content>
                                    <form id="addAgentForm" onSubmit={ handleSubmit }>
                                        <FinalFormField
                                            name="name"
                                            label="Agent Name"
                                            required={ true }
                                            placeholder="Enter agent name"
                                            autoComplete="new-password"
                                            component={ TextFieldAdapter }
                                            disabled={ isSubmitting }
                                            validate={ (value: string) => !value ? "Agent name is required" : undefined }
                                            data-componentid={ `${componentId}-name` }
                                        />
                                        <FinalFormField
                                            label="Description (optional)"
                                            name="description"
                                            className="mt-3"
                                            multiline
                                            rows={ 4 }
                                            maxRows={ 4 }
                                            autoComplete="new-password"
                                            placeholder="Enter a description for the agent"
                                            component={ TextFieldAdapter }
                                            disabled={ isSubmitting }
                                            data-componentid={ `${componentId}-description` }
                                        />

                                        <Divider hidden style={ { margin: "1.5rem 0" } } />

                                        <FinalFormField
                                            name="isUserServingAgent"
                                            label="Allow users to login to this agent"
                                            component={ CheckboxFieldAdapter }
                                            disabled={ isSubmitting }
                                            FormControlProps={ {
                                                margin: "dense"
                                            } }
                                            data-componentid={ `${componentId}-user-serving-checkbox` }
                                        />

                                        {isUserServingAgent && (
                                            <>
                                                <Divider hidden style={ { margin: "1.5rem 0" } } />

                                                <Field
                                                    name="agentType"
                                                    validate={ (value: string) => {
                                                        if (isUserServingAgent && !value) {
                                                            return "Please select an Agent Type";
                                                        }
                                                        return undefined;
                                                    } }
                                                >
                                                    {({ input, meta }) => (
                                                        <div style={ { marginBottom: "1rem" } }>
                                                            <label className="MuiFormLabel-root">
                                                                Agent Type <span style={ { color: "#f44336" } }>*</span>
                                                            </label>

                                                            <Form.Field>
                                                                <Radio
                                                                    label="Synchronous Agent"
                                                                    name="agentType"
                                                                    value={ AgentType.SYNCHRONOUS }
                                                                    checked={ input.value === AgentType.SYNCHRONOUS }
                                                                    onChange={ () => input.onChange(AgentType.SYNCHRONOUS) }
                                                                    disabled={ isSubmitting }
                                                                    data-componentid={ `${componentId}-agent-type-sync` }
                                                                />
                                                            </Form.Field>

                                                            {isSynchronous && (
                                                                <div style={ { marginLeft: "2rem", marginTop: "1rem", marginBottom: "1rem" } }>
                                                                    <FinalFormField
                                                                        name="callbackUrl"
                                                                        label="Callback URL"
                                                                        required={ true }
                                                                        placeholder="https://myapp.io/callback"
                                                                        autoComplete="new-password"
                                                                        component={ TextFieldAdapter }
                                                                        disabled={ isSubmitting }
                                                                        validate={ (value: string) => {
                                                                            if (!value) {
                                                                                return "Callback URL is required";
                                                                            }
                                                                            if (URLUtils.isURLValid(value)) {
                                                                                if (URLUtils.isHttpUrl(value, false) || URLUtils.isHttpsUrl(value, false)) {
                                                                                    return undefined;
                                                                                }
                                                                            }
                                                                            return t("applications:forms.inboundOIDC.fields.callBackUrls.validations.invalid");
                                                                        } }
                                                                        helperText="The URL to which the authorization code will be sent after user authentication"
                                                                        data-componentid={ `${componentId}-callback-url` }
                                                                    />
                                                                </div>
                                                            )}

                                                            <Form.Field>
                                                                <Radio
                                                                    label="Asynchronous Agent"
                                                                    name="agentType"
                                                                    value={ AgentType.ASYNCHRONOUS }
                                                                    checked={ input.value === AgentType.ASYNCHRONOUS }
                                                                    onChange={ () => input.onChange(AgentType.ASYNCHRONOUS) }
                                                                    disabled={ isSubmitting }
                                                                    data-componentid={ `${componentId}-agent-type-async` }
                                                                />
                                                            </Form.Field>

                                                            {meta.touched && meta.error && (
                                                                <div style={ {
                                                                    color: "#f44336",
                                                                    fontSize: "0.75rem",
                                                                    marginTop: "0.5rem"
                                                                } }>
                                                                    { meta.error }
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}
                                                </Field>

                                                {isAsynchronous && (
                                                    <div style={ { marginLeft: "2rem", marginTop: "1rem" } }>
                                                        <FinalFormField
                                                            name="cibaAuthReqExpiryTime"
                                                            label="CIBA Authentication Request Expiry Time (seconds)"
                                                            required={ true }
                                                            type="number"
                                                            placeholder="300"
                                                            autoComplete="new-password"
                                                            component={ TextFieldAdapter }
                                                            disabled={ isSubmitting }
                                                            helperText="Specify the expiry time for the CIBA authentication request"
                                                            data-componentid={ `${componentId}-ciba-expiry-time` }
                                                        />

                                                        <Divider hidden style={ { margin: "1rem 0" } } />

                                                        <FinalFormField
                                                            name="notificationChannels"
                                                            label="Notification Delivery Method"
                                                            component={ CheckboxGroupFieldAdapter }
                                                            disabled={ isSubmitting }
                                                            hint="Configure which notification methods this application supports"
                                                            options={ [
                                                                {
                                                                    label: "Email",
                                                                    value: "email"
                                                                },
                                                                {
                                                                    label: "SMS",
                                                                    value: "sms"
                                                                }
                                                            ] }
                                                            data-componentid={ `${componentId}-notification-channels` }
                                                        />
                                                    </div>
                                                )}
                                            </>
                                        )}
                                    </form>
                                </ModalWithSidePanel.Content>
                                <ModalWithSidePanel.Actions>
                                    <Grid>
                                        <Grid.Row column={ 1 }>
                                            <Grid.Column mobile={ 8 } tablet={ 8 } computer={ 8 }>
                                                <Button
                                                    className="link-button"
                                                    basic
                                                    onClick={ handleClose }
                                                    data-testid={ `${componentId}-cancel-button` }
                                                >
                                                    Cancel
                                                </Button>
                                            </Grid.Column>
                                            <Grid.Column mobile={ 8 } tablet={ 8 } computer={ 8 }>
                                                <Button
                                                    primary={ true }
                                                    disabled={ isSubmitting }
                                                    loading={ isSubmitting }
                                                    floated="right"
                                                    onClick={ () => {
                                                        document
                                                            .getElementById("addAgentForm")
                                                            .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
                                                    } }
                                                    data-testid={ `${componentId}-create-button` }
                                                >
                                                    Create
                                                </Button>
                                            </Grid.Column>
                                        </Grid.Row>
                                    </Grid>
                                </ModalWithSidePanel.Actions>
                            </ModalWithSidePanel.MainPanel>
                            <ModalWithSidePanel.SidePanel>
                                <ModalWithSidePanel.Header className="wizard-header help-panel-header muted">
                                    <div className="help-panel-header-text">
                                        Help
                                    </div>
                                </ModalWithSidePanel.Header>
                                <ModalWithSidePanel.Content>
                                    <Heading as="h6">Agent Name</Heading>
                                    <p>The name used for your agent.</p>

                                    <Divider />

                                    <Heading as="h6">Description</Heading>
                                    <p>A brief description of what your agent does.</p>

                                    <Divider />

                                    <Heading as="h6">Allow Users to Login</Heading>
                                    <p>
                                        Enable this option if your agent needs users to login to the agent to access
                                        user specific resources on behalf of the user. This will create an OAuth2/OIDC
                                        application for the agent.
                                    </p>

                                    {isUserServingAgent && (
                                        <>
                                            <Divider />

                                            <Heading as="h5">Agent Type</Heading>
                                            <p>Choose how your agent will interact with users and handle authentication.</p>

                                            <Divider />

                                            <Heading as="h6">Synchronous Agent</Heading>
                                            <p>
                                                An agent that works in real time, where the user provides inputs or questions,
                                                and the agent immediately responds and takes action based on what the user said -
                                                requiring the user to be actively present to guide the interaction forward.
                                            </p>

                                            <Divider />

                                            <Heading as="h6">Asynchronous Agent</Heading>
                                            <p>
                                                An agent that operates independently in the background, executing tasks and workflows
                                                without requiring continuous user presence, only engaging with the user when necessary.
                                            </p>

                                            {isSynchronous && (
                                                <>
                                                    <Divider />
                                                    <Heading as="h6">Callback URL</Heading>
                                                    <p>
                                                        The redirect URI where the authorization code is sent after user authentication.
                                                    </p>
                                                    <Hint compact>
                                                        E.g., https://myapp.io/callback
                                                    </Hint>
                                                </>
                                            )}
                                        </>
                                    )}
                                </ModalWithSidePanel.Content>
                            </ModalWithSidePanel.SidePanel>
                        </>
                    );
                } }
            />
        );
    };

    const renderSuccessScreen = (): ReactElement => {
        return (
            <>
                <ModalWithSidePanel.MainPanel>
                    <ModalWithSidePanel.Header className="wizard-header">
                        Agent Created Successfully
                        <Heading as="h6">
                            Your agent has been created. Please save the credentials below.
                        </Heading>
                    </ModalWithSidePanel.Header>
                    <ModalWithSidePanel.Content>
                        <Heading as="h6">Agent ID</Heading>
                        <CopyInputField
                            value={ creationResult?.agentId || "" }
                            data-componentid={ `${componentId}-agent-id-copy` }
                        />

                        <Divider hidden />

                        <Message warning>
                            <div style={ { display: "flex", alignItems: "center", gap: "0.5rem" } }>
                                <Icon name="warning sign" />
                                <span>
                                    Make sure to copy your agent secret now as you will not be able to see this again.
                                </span>
                            </div>
                        </Message>

                        <Heading as="h6">Agent Secret</Heading>
                        <CopyInputField
                            value={ creationResult?.agentSecret || "" }
                            secret
                            data-componentid={ `${componentId}-agent-secret-copy` }
                        />

                        {creationResult?.isUserServingAgent && (
                            <>
                                <Divider hidden />

                                <Heading as="h6">OAuth Client ID</Heading>
                                {creationResult?.oauthClientId ? (
                                    <CopyInputField
                                        value={ creationResult?.oauthClientId }
                                        data-componentid={ `${componentId}-client-id-copy` }
                                    />
                                ) : (
                                    <Hint>OAuth Client ID not available</Hint>
                                )}
                            </>
                        )}
                    </ModalWithSidePanel.Content>
                    <ModalWithSidePanel.Actions>
                        <Grid>
                            <Grid.Row column={ 1 }>
                                <Grid.Column mobile={ 16 } tablet={ 16 } computer={ 16 }>
                                    <Button
                                        primary={ true }
                                        floated="right"
                                        onClick={ handleClose }
                                        data-testid={ `${componentId}-done-button` }
                                    >
                                        Done
                                    </Button>
                                </Grid.Column>
                            </Grid.Row>
                        </Grid>
                    </ModalWithSidePanel.Actions>
                </ModalWithSidePanel.MainPanel>
                <ModalWithSidePanel.SidePanel>
                    <ModalWithSidePanel.Header className="wizard-header help-panel-header muted">
                        <div className="help-panel-header-text">
                            Help
                        </div>
                    </ModalWithSidePanel.Header>
                    <ModalWithSidePanel.Content>
                        <Heading as="h5">Important: Save Your Credentials</Heading>
                        <p>
                            Make sure to copy and store these credentials in a secure location.
                            The agent secret cannot be retrieved again after closing this dialog.
                        </p>

                        <Divider />

                        <Heading as="h6">Agent ID</Heading>
                        <p>
                            The unique identifier for your agent. Use this to reference the agent in your application.
                        </p>

                        <Divider />

                        <Heading as="h6">Agent Secret</Heading>
                        <p>
                            The password for your agent. Keep this secure and never share it publicly.
                        </p>

                        <Divider />

                        <Heading as="h6">OAuth Client ID</Heading>
                        <p>
                            The OAuth 2.0 client identifier for your agent application.
                            Use this for OAuth authentication flows. This is only available
                            if you enabled "Allow users to login to this agent".
                        </p>
                    </ModalWithSidePanel.Content>
                </ModalWithSidePanel.SidePanel>
            </>
        );
    };

    return (
        <ModalWithSidePanel
            open={ isOpen }
            className="wizard minimal-application-create-wizard"
            dimmer="blurring"
            onClose={ handleClose }
            closeOnDimmerClick={ false }
            closeOnEscape
            data-componentid={ `${componentId}-modal` }
        >
            {isShowingSuccessScreen ? renderSuccessScreen() : renderForm()}
        </ModalWithSidePanel>
    );
};

export default AddAgentWizard;
