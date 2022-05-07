/**
 *  Copyright 2022 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *
 *  Licensed under the Apache License, Version 2.0 (the "License"). You may not use this file except in compliance
 *  with the License. A copy of the License is located at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 *  or in the 'license' file accompanying this file. This file is distributed on an 'AS IS' BASIS, WITHOUT WARRANTIES
 *  OR CONDITIONS OF ANY KIND, express or implied. See the License for the specific language governing permissions
 *  and limitations under the License.
 */

// Imports
import { MskToLambda, MskToLambdaProps } from '../lib';
import { Aws, Stack, App } from '@aws-cdk/core';
import * as lambda from '@aws-cdk/aws-lambda';
import { generateIntegStackName } from '@aws-solutions-constructs/core';
import { KafkaVersion } from "@aws-cdk/aws-msk";
import * as defaults from '@aws-solutions-constructs/core';

// Setup
const app = new App();
const stack = new Stack(app, generateIntegStackName(__filename), {
  env: { account: Aws.ACCOUNT_ID, region: 'us-east-1' },
});
stack.templateOptions.description = 'Integration Test for aws-kinesisstreams-lambda';

const testExistingVpc = defaults.getTestVpc(stack);
// Definitions
const props: MskToLambdaProps = {
  lambdaFunctionProps: {
    runtime: lambda.Runtime.NODEJS_14_X,
    handler: 'index.handler',
    code: lambda.Code.fromAsset(`${__dirname}/lambda`)
  },
  clusterProps: {
    clusterName: 'test-cluster',
    kafkaVersion: KafkaVersion.V2_8_1,
  },
  existingVpc: testExistingVpc,
  mksEventSourceProps: {
    startingPosition: lambda.StartingPosition.TRIM_HORIZON,
    topic: 'test-topic'
  }
};

new MskToLambda(stack, 'test-mks-lambda', props);

// Synth
app.synth();