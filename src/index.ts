/* eslint-disable no-nested-ternary */
/* eslint-disable no-undefined */
const RP = require('./report-portal');
import { LogLevel, TestItemStatus } from './api';
import { ReportPortal } from './report-portal';
exports['default'] = () => {
    const client = new ReportPortal();
    let logs: any[];
    return {
        async reportTaskStart (startTime: any, userAgents: any[], testCount: any) {
            this.startTime = startTime;
            this.testCount = testCount;
            
            this.setIndent(1)
                .useWordWrap(true)
                .write(this.chalk.bold('Running tests in:'))
                .newline();

            userAgents.forEach((ua: any) => {
                this
                    .write(`- ${this.chalk.blue(ua)}`)
                    .newline();
            });
            
            await client.startLaunch();
        },

        async reportFixtureStart (name: any, /*path, meta*/) {
            this.currentFixtureName = name;
            this.setIndent(1)
                .useWordWrap(true);

            if (this.afterErrorList)
                this.afterErrorList = false;
            else
                this.newline();

            this.write(name)
                .newline()
                .newline();
        },
        async reportTestStart ( name: string /*, meta */) {
            await client.startTest(name);
            logs = [];
            console.log = function (d: string, rp = client) {
                logs.push({ type: 'info', log: d, time: new Date().valueOf() });
                process.stdout.write(d + '\n');
            };
            console.error = function (d: string) {
                logs.push({ type: 'error', log: d, time: new Date().valueOf() });
                process.stdout.write(d + '\n');
            };
            console.warn = function (d: string) {
                logs.push({ type: 'warning', log: d, time: new Date().valueOf() });
                process.stdout.write(d + '\n');
            };
            //console.debug = 
            logs.push({ type: 'debug', log: `Starting test ${name}...`, time: new Date().valueOf() });
        },
        async reportTestDone (name: any, testRunInfo: { errs: any; skipped: any; unstable: any; screenshotPath: any; screenshots: any[]; }, /*meta*/) {
            const errors      = testRunInfo.errs;
            const hasErrors   = errors !== undefined ? !!errors.length : false;

            let symbol    = null;

            let nameStyle = null;

            if (testRunInfo.skipped) {
                this.skipped++;

                symbol    = this.chalk.cyan('-');
                nameStyle = this.chalk.cyan;
            }
            else if (hasErrors) {
                symbol    = this.chalk.red.bold(this.symbols.err);
                nameStyle = this.chalk.red.bold;
            }
            else {
                symbol    = this.chalk.green(this.symbols.ok);
                nameStyle = this.chalk.grey;
            }

            let title = `${symbol} ${nameStyle(name)}`;

            this.setIndent(1)
                .useWordWrap(true);

            if (testRunInfo.unstable)
                title += this.chalk.yellow(' (unstable)');

            if (testRunInfo.screenshotPath)
                title += ` (screenshots: ${this.chalk.underline.grey(testRunInfo.screenshotPath)})`;

            this.newline().write(title);

            if (hasErrors)
                this._renderErrors(testRunInfo.errs);

            const result: TestItemStatus = testRunInfo.skipped ? 'SKIPPED' : hasErrors ? 'FAILED' : 'PASSED';

            this.afterErrorList = hasErrors;

            this.newline();
            if (testRunInfo.screenshots) {
                testRunInfo.screenshots.forEach((screenshot: { screenshotPath: any; }, idx: any) => {
                    logs.push({ type: 'debug', log: `Taking screenshot (${name}-${idx}.png)`, file: { name: `${name}-${idx}.png`, path: screenshot.screenshotPath }, time: new Date().valueOf() });
                });
            }
            logs.push({ type: 'debug', log: `Test ${name} has ended...`, time: new Date().valueOf() });
            logs.forEach(async (item: { log: string; type: LogLevel; time: string; file: { name: string; }; }) => {
                try {
                    if (item.log !== undefined)
                        item.log = item.log.indexOf('{') !== -1 && item.log.indexOf('}') !== -1 ? JSON.stringify(item.log) : item.log;
                    await client.sendTestLogs(client.test.id, item.type, item.log, item.time, item.file);
                } 
                catch (error) {
                    client.client.handleError(error);
                }
            });
            await client.finishTest(client.test.id, result);
        },

        async reportTaskDone (endTime: number, passed: number, warnings: string | any[]) {
            const durationMs  = endTime - this.startTime;
            const durationStr = this.moment.duration(durationMs).format('h[h] mm[m] ss[s]');

            var footer = passed === this.testCount ?
                this.chalk.bold.green(`${this.testCount} passed`) :
                this.chalk.bold.red(`${this.testCount - passed}/${this.testCount} failed`);

            footer += this.chalk.grey(` (${durationStr})`);

            this.newline()
                .setIndent(0)
                .write(footer)
                .newline();

            if (this.skipped > 0) {
                this.write(this.chalk.cyan(`${this.skipped} skipped`))
                    .newline();
            }

            if (warnings.length)
                this._renderWarnings(warnings);
            await client.finishLaunch();
        },
        _renderErrors (errs: any[]) {
            this.setIndent(3)
                .newline();

            errs.forEach((err: any, idx: number) => {
                logs.push({ type: 'error', log: JSON.stringify(err), time: new Date().valueOf() });
                var prefix = this.chalk.red(`${idx + 1}) `);

                this.newline()
                    .write(this.formatError(err, prefix))
                    .newline()
                    .newline();
            });
        },
        _renderWarnings (warnings: any[]) {
            this.newline()
                .setIndent(1)
                .write(this.chalk.bold.yellow(`Warnings (${warnings.length}):`))
                .newline();

            warnings.forEach((msg: any) => {
                this.setIndent(1)
                    .write(this.chalk.bold.yellow('--'))
                    .newline()
                    .setIndent(2)
                    .write(msg)
                    .newline();
            });
        }
    };
};

module.exports = exports['default'];
