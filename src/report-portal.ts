/* eslint-disable no-undefined */
//const RPClient = require('./api');
//const Arguments = require('cli-argument-parser').cliArguments;
//const fs = require('fs');
import { API, CreateLaunchResponse, CreateTestItemParameters, EntryCreatedAsyncRS, LogLevel, Options, TestItemStatus } from './api';
import { cliArguments } from 'cli-argument-parser'

export class ReportPortal {
    client: API
    isConnected: boolean
    launchName: string
    projectName: string
    launch: CreateLaunchResponse
    suite: EntryCreatedAsyncRS
    suiteName: string
    suiteStatus: TestItemStatus
    test: EntryCreatedAsyncRS;
    constructor () {
        if (!cliArguments.rdomain)
            throw new Error('Missing argument --rdomain');
        if (!cliArguments.rtoken)
            throw new Error('Missing argument --rtoken');
        if (!cliArguments.rlaunch && !cliArguments['rlaunch-id'])
            throw new Error('Missing argument --rlaunch/--rlaunch-id');
        if (!cliArguments.rproject)
            throw new Error('Missing argument --rproject');
        
        this.client = new API({
            protocol: 'https',
            domain:   cliArguments.rdomain,
            apiPath:  '/api/v1',
            token:    cliArguments.rtoken,
        });
        this.isConnected = true;
        this.launchName = cliArguments.rlaunch;
        this.projectName = cliArguments.rproject;
        if (cliArguments.rsuite) {
            this.suiteName = cliArguments.rsuite;
            this.suiteStatus = 'PASSED';
        }
    }

    /**
     * Verifying the connection to Report Portal
     */
    async verifyConnection () {
        try {
            await this.client.checkConnect();
            this.isConnected = true;
        } 
        catch (error) {
            console.log('Error connection to the Report Portal server');
            console.dir(error);
            this.isConnected = false;
        }
    }

    /**
     * Starting a new launch
     */
    async startLaunch () {
        await this.verifyConnection();
        if (!this.isConnected) throw Error('Report portal is not connected!');
        if (this.launchName) {
            this.launch = await this.client.createLaunch(this.projectName, {
                name:        this.launchName,
                startTime:   this.client.now(),
                description: `Running ${this.launchName} tests`,
            });
        }
        else
            this.launch = { id: cliArguments['rlaunch-id'] };
        if (this.suiteName)
            await this.startSuite(this.suiteName);
    }

    /**
     * Creating a new suite
     * @param {*} name The name of the suite
     */
    async startSuite (name: string) {
        this.suite = await this.client.createTestItem(this.projectName, {
            launchUuid: this.launch.id,
            name:       name,
            startTime:  this.client.now().toString(),
            type:       'SUITE'
        });
    }

    /**
     * Finishing a launch
     */
    async finishLaunch () {
        if (this.suiteName)
            await this.finishSuite(this.suite.id, this.suiteStatus);
        if (this.launchName)
            await this.client.finishLaunch(this.projectName, this.launch.id, { endTime: this.client.now() });
    }

    /**
     * Starting a new test
     * @param {*} name The name of the test
     */
    async startTest (name: string) {
        const options: CreateTestItemParameters = {
            launchUuid: this.launch.id,
            name:       name,
            startTime:  this.client.now().toString(),
            type:       'TEST'
        };

        //Incase the test needs to be under a suite
        if (this.suiteName)
            this.test = await this.client.createChildTestItem(this.projectName, this.suite.id, options);
        else
            this.test = await this.client.createTestItem(this.projectName, options);
    }

    /**
     * Finishing a test 
     * @param {*} testId The id of the test 
     * @param {*} status The final status of the test
     */
    async finishTest (testId: string, status: TestItemStatus) {
        if (this.suiteName && status === 'FAILED')
            this.suiteStatus = 'FAILED';

        await this.client.finishTestItem(this.projectName, testId, {
            launchUuid: this.launch.id,
            status:     status,
            endTime:    this.client.now()
        });
    }

    /**
     * Finishing a suite
     * @param {*} suiteId The id of the suite 
     * @param {*} status The final status of the suite
     */
    async finishSuite (suiteId: string, status: TestItemStatus) {
        await this.client.finishTestItem(this.projectName, suiteId, {
            launchUuid: this.launch.id,
            status:     status,
            endTime:    this.client.now()
        });
    }

    /**
     * Sending testing logs
     * @param {*} testId The id of the test
     * @param {*} level The level of the log (error/info/waiting, etc.)
     * @param {*} message The contents of the log message
     * @param {*} time The time it was sent/written. Default: current time.
     */
    async sendTestLogs (testId: string, level: LogLevel, message: string, time = this.client.now().toString(), attachment: {name: string}) {
        try {
            await this.client.sendLog(this.projectName, {
                itemUuid:   testId,
                launchUuid: this.launch.id,
                level:      level,
                message:    message,
                time:       time,
                file:       attachment
            });
        } 
        catch (error) {
            this.client.handleError(error);
        }
    }
}

module.exports = ReportPortal;
