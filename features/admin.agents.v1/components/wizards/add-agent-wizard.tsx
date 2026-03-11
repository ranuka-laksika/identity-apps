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
import { ModalWithSidePanel } from "@wso2is/admin.core.v1/components/modals/modal-with-side-panel";
import { AppState } from "@wso2is/admin.core.v1/store";
import { AlertLevels, IdentifiableComponentInterface } from "@wso2is/core/models";
import { addAlert } from "@wso2is/core/store";
import { CheckboxFieldAdapter, FinalForm, FinalFormField, FormRenderProps, RadioGroupFieldAdapter, TextFieldAdapter } from "@wso2is/form/src";
import { Button, Heading, Hint } from "@wso2is/react-components";
import React, { FunctionComponent, ReactElement, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Divider, Grid, Modal } from "semantic-ui-react";
import { addAgent } from "../../api/agents";
import { AgentScimSchema, AgentType } from "../../models/agents";

interface AddAgentWizardPropsInterface extends IdentifiableComponentInterface {
    isOpen: boolean;
    onClose: any;
}

enum WizardStep {
    BASIC_INFO = 0,
    AGENT_CONFIG = 1
}

interface FormValuesInterface {
    name?: string;
    description?: string;
    isUserServingAgent?: boolean;
    agentType?: AgentType;
    callbackUrl?: string;
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

    const [ currentStep, setCurrentStep ] = useState<WizardStep>(WizardStep.BASIC_INFO);
    const [ formValues, setFormValues ] = useState<FormValuesInterface>({});
    const [ isSubmitting, setIsSubmitting ] = useState<boolean>(false);

    const handleStepOneSubmit = (values: FormValuesInterface): void => {
        setFormValues({ ...formValues, ...values });

        if (values.isUserServingAgent) {
            setCurrentStep(WizardStep.AGENT_CONFIG);
        } else {
            createAgent({ ...formValues, ...values });
        }
    };

    const handleStepTwoSubmit = (values: FormValuesInterface): void => {
        const finalValues: FormValuesInterface = { ...formValues, ...values };

        createAgent(finalValues);
    };

    const createAgent = (values: FormValuesInterface): void => {
        if (!values?.name) {
            return;
        }

        setIsSubmitting(true);

        const addAgentPayload: AgentScimSchema = {
            "urn:scim:wso2:agent:schema": {
                Description: values?.description,
                DisplayName: values?.name,
                IsUserServingAgent: values?.isUserServingAgent || false,
                AgentType: values?.agentType,
                CallbackUrl: values?.callbackUrl,
                Owner: authenticatedUserInfo?.username
            }
        };

        addAgent(addAgentPayload)
            .then((response: AgentScimSchema) => {
                dispatch(
                    addAlert({
                        description: "Agent created successfully",
                        level: AlertLevels.SUCCESS,
                        message: "Success"
                    })
                );
                onClose({ ...response, isUserServingAgent: values?.isUserServingAgent });
            })
            .catch((_err: unknown) => {
                dispatch(
                    addAlert({
                        description: "Creating agent failed",
                        level: AlertLevels.ERROR,
                        message: "Something went wrong"
                    })
                );
            })
            .finally(() => {
                setIsSubmitting(false);
            });
    };

    const handleBack = (): void => {
        setCurrentStep(WizardStep.BASIC_INFO);
    };

    const handleCancel = (): void => {
        setCurrentStep(WizardStep.BASIC_INFO);
        setFormValues({});
        onClose(null);
    };

    const renderStepOne = (): ReactElement => {
        return (
            <FinalForm
                onSubmit={ handleStepOneSubmit }
                initialValues={ formValues }
                render={ ({ handleSubmit, values }: FormRenderProps) => {
                    const showNextButton: boolean = values?.isUserServingAgent === true;

                    return (
                        <>
                            <Modal.Content>
                                <form id="addAgentForm-step1" onSubmit={ handleSubmit }>
                                    <FinalFormField
                                        name="name"
                                        label="Name"
                                        required={ true }
                                        autoComplete="new-password"
                                        component={ TextFieldAdapter }
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
                                        data-componentid={ `${componentId}-description` }
                                    />
                                    <FinalFormField
                                        name="isUserServingAgent"
                                        label="Allow users to login to this agent"
                                        component={ CheckboxFieldAdapter }
                                        FormControlProps={ {
                                            margin: "dense"
                                        } }
                                        data-componentid={ `${componentId}-user-serving-checkbox` }
                                    />
                                </form>
                            </Modal.Content>
                            <Modal.Actions>
                                <Button
                                    className="link-button"
                                    basic
                                    primary
                                    onClick={ handleCancel }
                                    data-testid={ `${componentId}-cancel-button` }
                                >
                                    Cancel
                                </Button>
                                {showNextButton ? (
                                    <Button
                                        primary={ true }
                                        onClick={ () => {
                                            document
                                                .getElementById("addAgentForm-step1")
                                                .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
                                        } }
                                        data-testid={ `${componentId}-next-button` }
                                    >
                                        Next
                                    </Button>
                                ) : (
                                    <Button
                                        primary={ true }
                                        disabled={ isSubmitting }
                                        loading={ isSubmitting }
                                        onClick={ () => {
                                            document
                                                .getElementById("addAgentForm-step1")
                                                .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
                                        } }
                                        data-testid={ `${componentId}-create-button` }
                                    >
                                        Create
                                    </Button>
                                )}
                            </Modal.Actions>
                        </>
                    );
                } }
            />
        );
    };

    const renderStepTwo = (): ReactElement => {
        return (
            <FinalForm
                onSubmit={ handleStepTwoSubmit }
                initialValues={ formValues }
                render={ ({ handleSubmit, values }: FormRenderProps) => {
                    const isSynchronous: boolean = values?.agentType === AgentType.SYNCHRONOUS;

                    return (
                        <>
                            <ModalWithSidePanel.MainPanel>
                                <ModalWithSidePanel.Header className="wizard-header">
                                    Configure AI Agent
                                    <Heading as="h6">
                                        Configure authentication settings for your AI agent
                                    </Heading>
                                </ModalWithSidePanel.Header>
                                <ModalWithSidePanel.Content>
                                    <form id="addAgentForm-step2" onSubmit={ handleSubmit }>
                                        <FinalFormField
                                            name="agentType"
                                            label="AI Agent Type"
                                            required={ true }
                                            component={ RadioGroupFieldAdapter }
                                            options={ [
                                                {
                                                    label: "Synchronous AI Agent",
                                                    value: AgentType.SYNCHRONOUS
                                                },
                                                {
                                                    label: "Asynchronous AI Agent",
                                                    value: AgentType.ASYNCHRONOUS
                                                }
                                            ] }
                                            data-componentid={ `${componentId}-agent-type` }
                                        />

                                        {isSynchronous && (
                                            <>
                                                <Divider hidden style={ { margin: "1rem 0" } } />
                                                <FinalFormField
                                                    name="callbackUrl"
                                                    label="Callback URL"
                                                    required={ true }
                                                    placeholder="https://myapp.io/callback"
                                                    autoComplete="new-password"
                                                    component={ TextFieldAdapter }
                                                    helperText="The URL to which the authorization code will be sent"
                                                    data-componentid={ `${componentId}-callback-url` }
                                                />
                                            </>
                                        )}

                                        {!isSynchronous && values?.agentType && (
                                            <>
                                                <Divider hidden style={ { margin: "1rem 0" } } />
                                                <Hint>
                                                    This agent will use CIBA (Client Initiated Backchannel
                                                    Authentication) for user authentication. No callback URL is required.
                                                </Hint>
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
                                                    onClick={ handleBack }
                                                    data-testid={ `${componentId}-back-button` }
                                                >
                                                    Back
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
                                                            .getElementById("addAgentForm-step2")
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
                                    <Heading as="h5">AI Agent Type</Heading>
                                    <p>Choose how your agent will interact with users and handle authentication.</p>

                                    <Divider />

                                    <Heading as="h6">Synchronous AI Agent</Heading>
                                    <p>
                                        Provides <strong>real-time responses</strong> using OAuth 2.0 authorization code flow.
                                    </p>
                                    <p style={ { fontSize: "0.9em", color: "#767676" } }>
                                        <strong>Use Cases:</strong> Chatbots, real-time assistants, customer support
                                    </p>
                                    <p style={ { fontSize: "0.9em", color: "#767676" } }>
                                        <strong>Requires:</strong> Callback URL for authorization code
                                    </p>

                                    <Divider />

                                    <Heading as="h6">Asynchronous AI Agent</Heading>
                                    <p>
                                        Handles longer processes using <strong>CIBA</strong> (Client Initiated Backchannel Authentication).
                                    </p>
                                    <p style={ { fontSize: "0.9em", color: "#767676" } }>
                                        <strong>Use Cases:</strong> Task automation, workflow initiators, scheduled operations
                                    </p>
                                    <p style={ { fontSize: "0.9em", color: "#767676" } }>
                                        <strong>Authentication:</strong> CIBA grant with POLL mode - agent polls for authentication result
                                    </p>

                                    {isSynchronous && (
                                        <>
                                            <Divider />
                                            <Heading as="h6">Callback URL</Heading>
                                            <p>
                                                The redirect URI where the authorization code is sent after authentication.
                                            </p>
                                            <Hint compact>
                                                E.g., https://myapp.io/callback
                                            </Hint>
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

    if (currentStep === WizardStep.AGENT_CONFIG) {
        return (
            <ModalWithSidePanel
                open={ isOpen }
                className="wizard minimal-application-create-wizard"
                dimmer="blurring"
                onClose={ handleCancel }
                closeOnDimmerClick={ false }
                closeOnEscape
                data-componentid={ `${componentId}-modal-step2` }
            >
                {renderStepTwo()}
            </ModalWithSidePanel>
        );
    }

    return (
        <Modal
            data-testid={ componentId }
            data-componentid={ componentId }
            open={ isOpen }
            className="wizard"
            dimmer="blurring"
            size="tiny"
            onClose={ handleCancel }
            closeOnDimmerClick={ false }
            closeOnEscape
        >
            <Modal.Header>New Agent</Modal.Header>
            {renderStepOne()}
        </Modal>
    );
};

export default AddAgentWizard;
