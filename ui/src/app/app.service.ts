import {Injectable} from '@angular/core';
import {ProjectStore} from './service/project/project.store';
import {ActivatedRoute} from '@angular/router';
import {ApplicationStore} from './service/application/application.store';
import {NotificationService} from './service/notification/notification.service';
import {AuthentificationStore} from './service/auth/authentification.store';
import {TranslateService} from '@ngx-translate/core';
import {LoadOpts} from './model/project.model';
import {PipelineStore} from './service/pipeline/pipeline.store';
import {WorkflowStore} from './service/workflow/workflow.store';
import {RouterService} from './service/router/router.service';
import {first} from 'rxjs/operators';
import {Event, EventType} from './model/event.model';
import {EventStore} from './service/event/event.store';
import {WorkflowEventStore} from './service/workflow/workflow.event.store';
import {WorkflowNodeRun, WorkflowRun} from './model/workflow.run.model';
import {BroadcastStore} from './service/broadcast/broadcast.store';
import {Broadcast, BroadcastEvent} from './model/broadcast.model';

@Injectable()
export class AppService {

    constructor(private _projStore: ProjectStore, private _routeActivated: ActivatedRoute,
                private _appStore: ApplicationStore, private _notif: NotificationService, private _authStore: AuthentificationStore,
                private _translate: TranslateService, private _pipStore: PipelineStore, private _workflowEventStore: WorkflowEventStore,
                private _wfStore: WorkflowStore, private _routerService: RouterService, private _eventStore: EventStore,
                private _broadcastStore: BroadcastStore) {
    }

    manageEvent(event: Event): void {
        if (event.type_event.indexOf(EventType.PROJECT_PREFIX) === 0 || event.type_event.indexOf(EventType.ENVIRONMENT_PREFIX) === 0 ||
            event.type_event === EventType.APPLICATION_ADD || event.type_event === EventType.APPLICATION_UPDATE ||
            event.type_event === EventType.APPLICATION_DELETE ||
            event.type_event === EventType.PIPELINE_ADD || event.type_event === EventType.PIPELINE_UPDATE ||
            event.type_event === EventType.PIPELINE_DELETE || event.type_event.indexOf(EventType.PIPELINE_PARAMETER_PREFIX) === 0 ||
            event.type_event === EventType.PIPELINE_ADD || event.type_event === EventType.PIPELINE_UPDATE ||
            event.type_event === EventType.PIPELINE_DELETE ||
            event.type_event === EventType.WORKFLOW_ADD || event.type_event === EventType.WORKFLOW_UPDATE ||
            event.type_event === EventType.WORKFLOW_DELETE) {
            this.updateProjectCache(event);
        }
        if (event.type_event.indexOf(EventType.APPLICATION_PREFIX) === 0) {
            this.updateApplicationCache(event);
        } else if (event.type_event.indexOf(EventType.PIPELINE_PREFIX) === 0) {
            this.updatePipelineCache(event);
        } else if (event.type_event.indexOf(EventType.WORKFLOW_PREFIX) === 0) {
            this.updateWorkflowCache(event);
        } else if (event.type_event.indexOf(EventType.RUN_WORKFLOW_PREFIX) === 0) {
            this.updateWorkflowRunCache(event);
        } else if (event.type_event.indexOf(EventType.BROADCAST_PREFIX) === 0) {
            this.updateBroadcastCache(event);
        }
    }

    updateProjectCache(event: Event): void {
        this._projStore.getProjects('').pipe(first()).subscribe(projects => {
            // Project not in cache
            let projectInCache = projects.get(event.project_key);
            if (!projectInCache) {
                return;
            }

            // Get current route
            let params = this._routerService.getRouteParams({}, this._routeActivated);

            // If working on project or sub resources
            if (params['key'] && params['key'] === projectInCache.key) {
                // if modification from another user, display a notification
                if (event.username !== this._authStore.getUser().username) {
                    this._projStore.externalModification(projectInCache.key);
                    this._notif.create(this._translate.instant('warning_project', {username: event.username}));
                    return;
                }
            } else {
                // If no working on current project, remove from cache
                this._projStore.removeFromStore(projectInCache.key);
                return;
            }

            if (event.type_event === EventType.PROJECT_DELETE) {
                this._projStore.removeFromStore(projectInCache.key);
                return
            }

            let opts = [];
            if (event.type_event.indexOf(EventType.PROJECT_VARIABLE_PREFIX) === 0) {
                opts.push(new LoadOpts('withVariables', 'variables'));
            } else if (event.type_event.indexOf(EventType.PROJECT_PERMISSION_PREFIX) === 0) {
                opts.push(new LoadOpts('withGroups', 'groups'));
            } else if (event.type_event.indexOf(EventType.PROJECT_KEY_PREFIX) === 0) {
                opts.push(new LoadOpts('withKeys', 'keys'));
            } else if (event.type_event.indexOf(EventType.PROJECT_PLATFORM_PREFIX) === 0) {
                opts.push(new LoadOpts('withPlatforms', 'platforms'));
            } else if (event.type_event.indexOf(EventType.APPLICATION_PREFIX) === 0) {
                opts.push(new LoadOpts('withApplicationNames', 'application_names'));
            } else if (event.type_event.indexOf(EventType.PIPELINE_PREFIX) === 0) {
                opts.push(new LoadOpts('withPipelineNames', 'pipeline_names'));
            } else if (event.type_event.indexOf(EventType.ENVIRONMENT_PREFIX) === 0) {
                opts.push(new LoadOpts('withEnvironments', 'environments'));
            } else if (event.type_event.indexOf(EventType.WORKFLOW_PREFIX) === 0) {
                opts.push(new LoadOpts('withWorkflowNames', 'workflow_names'));
            }
            this._projStore.resync(projectInCache.key, opts).pipe(first()).subscribe(() => {});
        });
    }

    updateApplicationCache(event: Event): void {
        let appKey = event.project_key + '-' + event.application_name;
        if (event.type_event === EventType.APPLICATION_DELETE) {
            this._appStore.removeFromStore(appKey);
            return;
        }

        this._appStore.getApplications(event.project_key, null).pipe(first()).subscribe(apps => {
            if (!apps) {
                return;
            }

            if (!apps.get(appKey)) {
                return;
            }

            // Get current route
            let params = this._routerService.getRouteParams({}, this._routeActivated);

            // If working on the application
            if (params['key'] && params['key'] === event.project_key && params['appName'] === event.application_name) {
                // modification by another user
                if (event.username !== this._authStore.getUser().username) {
                    this._appStore.externalModification(appKey);
                    this._notif.create(this._translate.instant('warning_application', {username: event.username}));
                    return;
                }
            } else {
                this._appStore.removeFromStore(appKey);
                return;
            }

            this._appStore.resync(event.project_key, event.application_name);

        });

    }

    updatePipelineCache(event: Event): void {
        let pipKey = event.project_key + '-' + event.pipeline_name;
        if (event.type_event === EventType.PIPELINE_DELETE) {
            this._appStore.removeFromStore(pipKey);
            return;
        }

        this._pipStore.getPipelines(event.project_key).pipe(first()).subscribe(pips => {
            if (!pips) {
                return;
            }

            if (!pips.get(pipKey)) {
                return;
            }

            let params = this._routerService.getRouteParams({}, this._routeActivated);

            // update pipeline
            if (params['key'] && params['key'] === event.project_key && params['pipName'] === event.pipeline_name) {
                if (event.username !== this._authStore.getUser().username) {
                    this._pipStore.externalModification(pipKey);
                    this._notif.create(this._translate.instant('warning_pipeline', {username: event.username}));
                    return;
                }
            } else {
                this._pipStore.removeFromStore(pipKey);
                return;
            }

            this._pipStore.resync(event.project_key, event.pipeline_name);
        });
    }

    updateWorkflowCache(event: Event): void {
        let wfKey = event.project_key + '-' + event.workflow_name;
        if (event.type_event === EventType.WORKFLOW_DELETE) {
            this._appStore.removeFromStore(wfKey);
            return;
        }
        this._wfStore.getWorkflows(event.project_key).pipe(first()).subscribe(wfs => {
            if (!wfs) {
                return;
            }

            if (!wfs.get(wfKey)) {
                return;
            }

            let params = this._routerService.getRouteParams({}, this._routeActivated);

            // update workflow
            if (params['key'] && params['key'] === event.project_key && params['workflowName'] === event.workflow_name) {
                if (event.username !== this._authStore.getUser().username) {
                    this._wfStore.externalModification(wfKey);
                    this._notif.create(this._translate.instant('warning_workflow', {username: event.username}));
                    return
                }
            } else {
                this._wfStore.removeFromStore(wfKey);
                return;
            }

            this._wfStore.resync(event.project_key, event.workflow_name);
        });
    }

    updateWorkflowRunCache(event: Event): void {
        switch (event.type_event) {
            case EventType.RUN_WORKFLOW_PREFIX:
                let wr = WorkflowRun.fromEventRunWorkflow(event);
                this._workflowEventStore.broadcastWorkflowRun(event.project_key, event.workflow_name, wr);
                break;
            case EventType.RUN_WORKFLOW_NODE:
                let wnr = WorkflowNodeRun.fromEventRunWorkflowNode(event);
                this._workflowEventStore.broadcastNodeRunEvents(wnr);
                break;
        }
        this._eventStore._eventFilter.getValue();
    }

    updateBroadcastCache(event: Event): void {
        switch (event.type_event) {
            case EventType.BROADCAST_ADD:
                let bEvent: BroadcastEvent = <BroadcastEvent>event.payload['Broadcast'];
                if (bEvent) {
                    this._broadcastStore.addBroadcastInCache(Broadcast.fromEvent(bEvent));
                }
                break;
            case EventType.BROADCAST_UPDATE:
                let bUpEvent: BroadcastEvent = <BroadcastEvent>event.payload['NewBroadcast'];
                if (bUpEvent) {
                    this._broadcastStore.addBroadcastInCache(Broadcast.fromEvent(bUpEvent));
                }
                break;
            case EventType.BROADCAST_DELETE:
                this._broadcastStore.removeBroadcastFromCache(event.payload['BroadcastID']);
                break;
        }
    }
}
