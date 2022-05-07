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
import { Stack } from "@aws-cdk/core";
import { MskToLambda, MskToLambdaProps } from "../lib";
import * as lambda from '@aws-cdk/aws-lambda';
import '@aws-cdk/assert/jest';
import { KafkaVersion } from "@aws-cdk/aws-msk";
import * as defaults from '@aws-solutions-constructs/core';

test('Test specify no lambda or cluster throws lambda error', () => {
  // Initial Setup
  const stack = new Stack();
  const props: MskToLambdaProps = {
    mksEventSourceProps: {
      startingPosition: lambda.StartingPosition.TRIM_HORIZON,
      topic: 'test-topic',
    }
  };
  const app = () => {
    new MskToLambda(stack, 'test-mks-lambda', props);
  };
  // Assertion 1
  expect(app).toThrowError("Either existingLambdaObj or lambdaFunctionProps is required");
});

test('Test specify lambda but no cluster throws cluster error', () => {
  // Initial Setup
  const stack = new Stack();
  const props: MskToLambdaProps = {
    lambdaFunctionProps: {
      runtime: lambda.Runtime.NODEJS_14_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset(`${__dirname}/lambda`)
    },
    mksEventSourceProps: {
      startingPosition: lambda.StartingPosition.TRIM_HORIZON,
      topic: 'test-topic',
    }
  };
  const app = () => {
    new MskToLambda(stack, 'test-mks-lambda', props);
  };
  // Assertion 1
  expect(app).toThrowError("Either existingClusterObj or clusterProps is required");
});

// TODO specify vpc in clusterProps gives error

test('Test specify lambda but no cluster throws cluster error', () => {
  // Initial Setup
  const stack = new Stack();
  const vpc = defaults.getTestVpc(stack);
  const props: MskToLambdaProps = {
    lambdaFunctionProps: {
      runtime: lambda.Runtime.NODEJS_14_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset(`${__dirname}/lambda`)
    },
    clusterProps: {
      clusterName: 'test-cluster',
      kafkaVersion: KafkaVersion.V2_8_1,
      vpc
    },
    existingVpc: vpc,
    mksEventSourceProps: {
      startingPosition: lambda.StartingPosition.TRIM_HORIZON,
      topic: 'test-topic'
    }
  };
  const app = () => {
    new MskToLambda(stack, 'test-mks-lambda', props);
  };
  // Assertion 1
  expect(app).toThrowError("Cannot provide a VPC in both the clusterProps and the function argument");
});

test('Test properties', () => {
  // Initial Setup
  const stack = new Stack();
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
    mksEventSourceProps: {
      startingPosition: lambda.StartingPosition.TRIM_HORIZON,
      topic: 'test-topic',
    }
  };
  const app = new MskToLambda(stack, 'test-mks-lambda', props);
  // Assertion 1
  expect(app.lambdaFunction !== null);
  // Assertion 2
  expect(app.mskCluster !== null);
  // Assertion 3
  expect(app.vpc !== null);
});
