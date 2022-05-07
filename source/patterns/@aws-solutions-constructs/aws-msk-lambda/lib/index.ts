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

import * as lambda from '@aws-cdk/aws-lambda';
import * as msk from '@aws-cdk/aws-msk';
import * as ec2 from '@aws-cdk/aws-ec2';
import * as defaults from '@aws-solutions-constructs/core';
// Note: To ensure CDKv2 compatibility, keep the import statement for Construct separate
import { Construct } from '@aws-cdk/core';
import { ManagedKafkaEventSource, KafkaEventSourceProps } from '@aws-cdk/aws-lambda-event-sources';

// ********************
// JPK core stuff
// ********************
import { overrideProps, consolidateProps } from '../../core/lib/utils';
import { SqsDlq, ManagedKafkaEventSourceProps } from '@aws-cdk/aws-lambda-event-sources';
import * as sqs from '@aws-cdk/aws-sqs';
import { buildQueue } from '../../core/lib/sqs-helper';
import { EventSourceProps } from '../../core/lib/lambda-event-source-mapping-defaults';

/**
 * @summary The properties for the SnsToLambda class.
 */
export interface MskToLambdaProps {
  /**
   * Existing instance of Lambda Function object, providing both this and `lambdaFunctionProps` will cause an error.
   *
   * @default - None
   */
  readonly existingLambdaObj?: lambda.Function,
  /**
   * User provided props to override the default props for the Lambda function.
   *
   * @default - Default properties are used.
   */
  readonly lambdaFunctionProps?: lambda.FunctionProps,
  /**
   * Optional custom properties for a VPC the construct will create. This VPC will
   * be used by the new MSK cluster the construct creates. Providing
   * both this and existingVpc is an error.
   *
   * @default - none
   */
  readonly vpcProps?: ec2.VpcProps;
   /**
    * An existing VPC in which to deploy the construct. Providing both this and
    * vpcProps or existingClusterObj is an error.
    *
    * @default - none
    */
  readonly existingVpc?: ec2.IVpc;
  /**
   * Existing instance of MSK cluster object, providing both this and clusterProps will cause an error..
   *
   * @default - Default props are used
   */
  readonly existingClusterObj?: msk.ICluster,
  /**
   * Optional user provided properties to override the default properties for the MSK cluster.
   *
   * @default - Default properties are used.
   */
  readonly clusterProps?: msk.ClusterProps | any
  /**
   *
   */
  readonly mksEventSourceProps: KafkaEventSourceProps
  /**
   * Whether to deploy a SQS dead letter queue when a data record reaches the Maximum Retry Attempts or Maximum Record Age,
   * its metadata like shard ID and stream ARN will be sent to an SQS queue.
   *
   * @default - true.
   */
  readonly deploySqsDlqQueue?: boolean,
  /**
   * Optional user provided properties for the SQS dead letter queue
   *
   * @default - Default props are used
   */
  readonly sqsDlqQueueProps?: sqs.QueueProps
}

export interface BuildClusterProps {
  /**
   * Existing instance of SNS Topic object, providing both this and `topicProps` will cause an error.
   *
   * @default - None.
   */
  readonly existingClusterObj?: msk.ICluster,
  /**
   * Optional user provided props to override the default props for the SNS topic.
   *
   * @default - Default props are used.
   */
  readonly clusterProps?: msk.ClusterProps
  /**
   *
   */
  readonly vpc: ec2.IVpc
}

/* JPK return does not have to be array */
function buildMskCluster(scope: Construct, props: BuildClusterProps): [msk.ICluster] {
  // Conditional cluster creation
  if (!props.existingClusterObj) {
    if (props.clusterProps) {
      return [deployMskCluster(scope, props.vpc, props.clusterProps, undefined)];
    } else {
      throw Error('Either existingClusterObj or clusterProps is required');
    }
  } else {
    // if props.vpc and the existingClusterObj is not in a vpc an exeption should be raised (isBoundToVpc does not exist on ICluster)
    return [props.existingClusterObj];
  }
}

export function deployMskCluster(scope: Construct,
  vpc: ec2.IVpc,
  clusterProps: msk.ClusterProps,
  clusterId?: string
  /* JPK possible extra params */): msk.Cluster {
  const _clusterId = clusterId ? clusterId : 'MskCluster';

  if (vpc && clusterProps.vpc) { // JPK vpc always >
    throw new Error(
      "Cannot provide a VPC in both the clusterProps and the function argument"
    );
  }

  // Override the DefaultClusterProps with user provided clusterProps
  let finalClusterProps: msk.ClusterProps = overrideProps(DefaultClusterProps(), clusterProps);

  if (vpc) {
    finalClusterProps = overrideProps(finalClusterProps, {
      // JPK securityGroups: [ lambdaSecurityGroup ],
      vpc,
    });
  }

  const cluster = new msk.Cluster(scope, _clusterId, finalClusterProps);

  return cluster;
}

export function DefaultClusterProps(): msk.ClusterProps | any {

  const clusterProps: msk.ClusterProps | any = {
  };

  return clusterProps;
}

export function ManagedKafkaEventSourcePropsJPK(scope: Construct,
  clusterArn: string,
  topic: string,
  _mksEventSourceProps?: EventSourceProps): ManagedKafkaEventSourceProps {
  const baseProps: ManagedKafkaEventSourceProps = {
    startingPosition: lambda.StartingPosition.TRIM_HORIZON,
    clusterArn,
    topic
    // secret?
  };

  let extraProps = {};

  if (_mksEventSourceProps === undefined || _mksEventSourceProps?.deploySqsDlqQueue === undefined
    || _mksEventSourceProps.deploySqsDlqQueue) {
    const [sqsQueue] = buildQueue(scope, 'SqsDlqQueue', {
      queueProps: _mksEventSourceProps?.sqsDlqQueueProps
    });

    extraProps = {
      onFailure: new SqsDlq(sqsQueue),
    };
  }

  const defaultKinesisEventSourceProps = Object.assign(baseProps, extraProps);

  return consolidateProps(defaultKinesisEventSourceProps, _mksEventSourceProps?.eventSourceProps);
}

/**
 * @summary The MskToLambda class.
 */
export class MskToLambda extends Construct {
  public readonly lambdaFunction: lambda.Function;
  public readonly mskCluster: msk.ICluster;
  public readonly vpc: ec2.IVpc;

  /**
   * @summary Constructs a new instance of the LambdaToSns class.
   * @param {cdk.App} scope - represents the scope for all the resources.
   * @param {string} id - this is a a scope-unique id.
   * @param {MskToLambdaProps} props - user provided props for the construct.
   * @since 0.8.0
   * @access public
   */
  constructor(scope: Construct, id: string, props: MskToLambdaProps) {
    super(scope, id);
    defaults.CheckProps(props);

    // Setup the Lambda function
    this.lambdaFunction = defaults.buildLambdaFunction(this, {
      existingLambdaObj: props.existingLambdaObj,
      lambdaFunctionProps: props.lambdaFunctionProps
    });

    this.vpc = defaults.buildVpc(scope, {
      existingVpc: props.existingVpc,
      defaultVpcProps: defaults.DefaultIsolatedVpcProps(), // JPK props.publicApi ? defaults.DefaultPublicPrivateVpcProps() :
      userVpcProps: props.vpcProps,
      constructVpcProps: { enableDnsHostnames: true, enableDnsSupport: true }
    });

    // Setup the MSK cluster
    [this.mskCluster] = buildMskCluster(this, {
      existingClusterObj: props.existingClusterObj,
      clusterProps: props.clusterProps,
      vpc: this.vpc
    });

    // Add the Lambda event source mapping
    const eventSourceProps = ManagedKafkaEventSourcePropsJPK(this, this.mskCluster.clusterArn, props.mksEventSourceProps.topic, {
      eventSourceProps: props.mksEventSourceProps,
      deploySqsDlqQueue: props.deploySqsDlqQueue,
      sqsDlqQueueProps: props.sqsDlqQueueProps
    });
    this.lambdaFunction.addEventSource(new ManagedKafkaEventSource(eventSourceProps));

    // create mskAlarms for records expiring or lag being >

  }
}